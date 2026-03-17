import { FlowLogger } from '../logger/logger';
import {
  FlowGraph,
  FlowNode,
  FrontendNode,
  FrontendEdge,
  FrontendExecutionPath,
  NodeDetail,
  ResolvedFlowMapConfig,
} from '../dto/config.dto';
import { AstParserService } from '../ast/ast-parser.service';
import { CacheService } from '../cache/cache.service';
import { NanoAgentService } from '../nano-agent/nano-agent.service';
import { SidecarService } from '../sidecar/sidecar.service';
import { MAX_EXECUTION_DEPTH, DETAIL_EXPANSION_DEPTH, NANO_AGENT_BATCH_SIZE } from '../constants';

type OrderedAdj = Map<string, string[]>;

const LOGGER_CONTEXT = 'FlowMapService';

export class FlowMapService {
  private readonly astParser: AstParserService;
  private readonly cache: CacheService;
  private readonly sidecar: SidecarService;
  private readonly nanoAgent: NanoAgentService | null;
  private readonly config: ResolvedFlowMapConfig;

  constructor(
    config: ResolvedFlowMapConfig,
    astParser: AstParserService,
    cache: CacheService,
    sidecar: SidecarService,
    nanoAgent: NanoAgentService | null,
  ) {
    this.config = config;
    this.astParser = astParser;
    this.cache = cache;
    this.sidecar = sidecar;
    this.nanoAgent = nanoAgent;
  }

  async buildAndServeGraph(): Promise<FlowGraph> {
    const graph = this.astParser.parse(this.config.sourceRoot);

    // Serve immediately without AI so the frontend is never blocked
    const paths = this.buildExecutionPaths(graph);
    this.sidecar.updateGraph(graph);
    this.sidecar.updatePaths(paths);

    FlowLogger.info(LOGGER_CONTEXT, 'Graph built and served', {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      paths: paths.length,
    });

    if (this.config.enableAI && this.nanoAgent) {
      this.sidecar.setAiEnriching(true);
      this.enrichWithAiSummaries(graph)
        .then(() => {
          const enrichedPaths = this.buildExecutionPaths(graph);
          this.sidecar.updateGraph(graph);
          this.sidecar.updatePaths(enrichedPaths);
        })
        .catch((err: Error) => {
          FlowLogger.error(LOGGER_CONTEXT, 'Background AI enrichment failed', { error: err.message });
        })
        .finally(() => {
          this.sidecar.setAiEnriching(false);
        });
    }

    return graph;
  }

  buildExecutionPaths(graph: FlowGraph): FrontendExecutionPath[] {
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const orderedAdj = this.buildOrderedAdj(graph);

    const entryPoints = graph.nodes.filter((n) => n.type === 'controller');
    if (entryPoints.length === 0) return this.fallbackSinglePath(graph);

    return entryPoints.map((controller) => {
      const nodeDetails: Record<string, NodeDetail> = {};
      const { nodes, edges } = this.buildRootLayer(controller, orderedAdj, nodeMap, nodeDetails);
      return {
        endpoint: this.resolveEndpoint(controller),
        method: controller.httpMethod ?? 'GET',
        nodes,
        edges,
        nodeDetails,
      };
    });
  }

  private buildOrderedAdj(graph: FlowGraph): OrderedAdj {
    const edgesByFrom = new Map<string, { to: string; callOrder: number }[]>();
    for (const edge of graph.edges) {
      if (!edgesByFrom.has(edge.from)) edgesByFrom.set(edge.from, []);
      edgesByFrom.get(edge.from)!.push({ to: edge.to, callOrder: edge.callOrder });
    }
    const orderedAdj: OrderedAdj = new Map();
    for (const [from, children] of edgesByFrom) {
      orderedAdj.set(
        from,
        children.sort((a, b) => a.callOrder - b.callOrder).map((c) => c.to),
      );
    }
    return orderedAdj;
  }

  private buildRootLayer(
    controller: FlowNode,
    orderedAdj: OrderedAdj,
    nodeMap: Map<string, FlowNode>,
    nodeDetails: Record<string, NodeDetail>,
  ): { nodes: FrontendNode[]; edges: FrontendEdge[] } {
    const rootNodes: FrontendNode[] = [];
    const rootEdges: FrontendEdge[] = [];
    const visited = new Set<string>([controller.id]);

    const controllerHasDetail = (orderedAdj.get(controller.id) ?? []).length > 0;
    rootNodes.push(this.toFrontendNode(controller, { hasDetail: controllerHasDetail }));
    if (controllerHasDetail) {
      this.buildDetail(controller.id, orderedAdj, nodeMap, nodeDetails);
    }

    let prevId = controller.id;
    let globalStepCounter = 0;

    const directChildren = (orderedAdj.get(controller.id) ?? [])
      .map((id) => nodeMap.get(id))
      .filter((n): n is FlowNode => !!n);

    for (const child of directChildren) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);

      const childHasDetail = (orderedAdj.get(child.id) ?? []).length > 0;
      const isFirst = prevId === controller.id;

      rootNodes.push(
        this.toFrontendNode(child, {
          hasDetail: childHasDetail,
          stepNumber: child.customTag ? ++globalStepCounter : undefined,
        }),
      );
      rootEdges.push({
        id: `${prevId}→${child.id}`,
        source: prevId,
        target: child.id,
        callOrder: 0,
        edgeType: isFirst ? 'call' : 'step',
      });
      prevId = child.id;

      if (childHasDetail) {
        this.buildDetail(child.id, orderedAdj, nodeMap, nodeDetails);
      }

      const flowSteps = this.collectFlowSteps(child.id, orderedAdj, nodeMap, new Set(visited));
      for (const step of flowSteps) {
        if (visited.has(step.id)) continue;
        visited.add(step.id);

        const stepHasDetail = (orderedAdj.get(step.id) ?? []).length > 0;
        rootNodes.push(
          this.toFrontendNode(step, {
            hasDetail: stepHasDetail,
            stepNumber: ++globalStepCounter,
          }),
        );
        rootEdges.push({
          id: `${prevId}→${step.id}`,
          source: prevId,
          target: step.id,
          callOrder: globalStepCounter,
          edgeType: 'step',
        });
        prevId = step.id;

        if (stepHasDetail) {
          this.buildDetail(step.id, orderedAdj, nodeMap, nodeDetails);
        }
      }
    }

    return { nodes: rootNodes, edges: rootEdges };
  }

  private collectFlowSteps(
    startId: string,
    orderedAdj: OrderedAdj,
    nodeMap: Map<string, FlowNode>,
    visited: Set<string>,
  ): FlowNode[] {
    const steps: FlowNode[] = [];

    for (const childId of orderedAdj.get(startId) ?? []) {
      if (visited.has(childId)) continue;
      visited.add(childId);

      const child = nodeMap.get(childId);
      if (!child) continue;

      if (child.customTag) steps.push(child);
      steps.push(...this.collectFlowSteps(childId, orderedAdj, nodeMap, visited));
    }

    return steps;
  }

  private buildDetail(
    startId: string,
    orderedAdj: OrderedAdj,
    nodeMap: Map<string, FlowNode>,
    nodeDetails: Record<string, NodeDetail>,
  ): NodeDetail {
    if (startId in nodeDetails) return nodeDetails[startId];

    const startNode = nodeMap.get(startId);
    if (!startNode) {
      nodeDetails[startId] = { nodes: [], edges: [] };
      return nodeDetails[startId];
    }

    nodeDetails[startId] = { nodes: [], edges: [] };

    const resultNodes: FrontendNode[] = [];
    const resultEdges: FrontendEdge[] = [];
    const visited = new Set<string>([startId]);

    const directChildren = orderedAdj.get(startId) ?? [];
    resultNodes.push(this.toFrontendNode(startNode, { hasDetail: false }));

    let stepCounter = 0;
    let prevId = startId;
    let callOrder = 0;

    const addToChain = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      const node = nodeMap.get(nodeId);
      if (!node) return;
      visited.add(nodeId);

      const children = orderedAdj.get(nodeId) ?? [];
      const isPassThrough = children.length === 1;
      const hasDetail = !isPassThrough && children.length > 0;

      resultNodes.push(
        this.toFrontendNode(node, {
          hasDetail,
          stepNumber: node.customTag ? ++stepCounter : undefined,
        }),
      );
      resultEdges.push({
        id: `${prevId}→${nodeId}`,
        source: prevId,
        target: nodeId,
        callOrder: callOrder++,
        edgeType: callOrder === 1 ? 'call' : 'step',
      });
      prevId = nodeId;

      if (hasDetail && !(nodeId in nodeDetails)) {
        this.buildDetail(nodeId, orderedAdj, nodeMap, nodeDetails);
      }

      if (isPassThrough) {
        addToChain(children[0]);
      }
    };

    directChildren.forEach((childId) => addToChain(childId));

    const detail: NodeDetail = { nodes: resultNodes, edges: resultEdges };
    nodeDetails[startId] = detail;
    return detail;
  }

  private resolveEndpoint(controller: FlowNode): string {
    if (controller.routePath) return controller.routePath;
    const name = controller.methodName;
    return `/${name.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`).replace(/^-/, '')}`;
  }

  private toFrontendNode(
    node: FlowNode,
    opts: { hasDetail?: boolean; stepNumber?: number } = {},
  ): FrontendNode {
    return {
      id: node.id,
      type: node.customTag || node.aiSummary ? 'enhanced' : 'standard',
      funcName: node.methodName,
      fileName: node.filePath,
      line: node.lineNumber,
      intentTag: node.customTag,
      docstring: node.docstring,
      aiSummary: node.aiSummary,
      hasDetail: opts.hasDetail ?? false,
      stepNumber: opts.stepNumber,
    };
  }

  private fallbackSinglePath(graph: FlowGraph): FrontendExecutionPath[] {
    return [
      {
        endpoint: '/*',
        method: 'ALL',
        nodes: graph.nodes.map((n) => this.toFrontendNode(n, { hasDetail: false })),
        edges: graph.edges.map((e) => ({
          id: `${e.from}→${e.to}`,
          source: e.from,
          target: e.to,
          callOrder: e.callOrder,
          edgeType: 'call' as const,
        })),
        nodeDetails: {},
      },
    ];
  }

  private async enrichWithAiSummaries(graph: FlowGraph): Promise<void> {
    // Deduplicate: nodes sharing the same body hash need only one API call
    const hashToNodes = new Map<string, FlowNode[]>();
    const toFetch: FlowNode[] = [];

    for (const node of graph.nodes) {
      const hash = this.cache.hashBody(node.rawBody);
      const cached = this.cache.get(node.id, hash);
      if (cached) {
        node.aiSummary = cached;
        continue;
      }
      const group = hashToNodes.get(hash);
      if (group) {
        group.push(node);
      } else {
        hashToNodes.set(hash, [node]);
        toFetch.push(node);
      }
    }

    FlowLogger.info(LOGGER_CONTEXT, `Enriching ${toFetch.length} unique nodes with AI summaries (${graph.nodes.length} total)`);

    let attempted = 0;
    let failed = 0;

    for (let i = 0; i < toFetch.length; i += NANO_AGENT_BATCH_SIZE) {
      const batch = toFetch.slice(i, i + NANO_AGENT_BATCH_SIZE);
      await Promise.all(batch.map(async (node) => {
        const hash = this.cache.hashBody(node.rawBody);
        attempted++;
        try {
          const summary = await this.nanoAgent!.summarize(node);
          for (const n of hashToNodes.get(hash) ?? [node]) {
            n.aiSummary = summary;
            this.cache.set(n.id, hash, summary);
          }
        } catch (err) {
          failed++;
          FlowLogger.warn(LOGGER_CONTEXT, 'AI summary failed for node, skipping', {
            nodeId: node.id,
            error: (err as Error).message,
          });
        }
      }));
    }

    if (attempted > 0 && failed === attempted) {
      FlowLogger.error(LOGGER_CONTEXT, 'All AI summary requests failed — check your provider, model, and API key', {
        attempted,
        failed,
      });
    }
  }
}
