import { FlowLogger } from '../logger/flow-logger';
import {
  FlowGraph,
  FlowNode,
  FrontendNode,
  FrontendEdge,
  FrontendExecutionPath,
  NodeDetail,
  ResolvedFlowMapperConfig,
} from '../dto/flow-mapper-config.dto';
import { AstParserService } from '../ast/ast-parser.service';
import { CacheService } from '../cache/cache.service';
import { NanoAgentService } from '../nano-agent/nano-agent.service';
import { SidecarService } from '../sidecar/sidecar.service';
import { MAX_EXECUTION_DEPTH, DETAIL_EXPANSION_DEPTH, NANO_AGENT_BATCH_SIZE } from '../constants';

type OrderedAdj = Map<string, string[]>;

const LOGGER_CONTEXT = 'FlowMapperService';

export class FlowMapperService {
  private readonly astParser: AstParserService;
  private readonly cache: CacheService;
  private readonly sidecar: SidecarService;
  private readonly nanoAgent: NanoAgentService | null;
  private readonly config: ResolvedFlowMapperConfig;

  constructor(
    config: ResolvedFlowMapperConfig,
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
      // Per-path nodeDetails: only contains details for nodes reachable from this controller.
      // Keeping it isolated avoids duplicating the entire graph across 40+ paths in the JSON response.
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

  /**
   * Build ordered adjacency map: nodeId → [childId, ...] sorted by callOrder (source position).
   */
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

  /**
   * Build the root layer for one controller: controller → direct children → @FlowStep descendants.
   *
   * Everything is a clean vertical chain — no fan-out. Nodes that have sub-calls get
   * hasDetail=true and their internal graph is stored in nodeDetails.
   */
  private buildRootLayer(
    controller: FlowNode,
    orderedAdj: OrderedAdj,
    nodeMap: Map<string, FlowNode>,
    nodeDetails: Record<string, NodeDetail>,
  ): { nodes: FrontendNode[]; edges: FrontendEdge[] } {
    const rootNodes: FrontendNode[] = [];
    const rootEdges: FrontendEdge[] = [];
    const visited = new Set<string>([controller.id]);

    // Controller: always drillable if it has children (uncommon but possible)
    const controllerHasDetail = (orderedAdj.get(controller.id) ?? []).length > 0;
    rootNodes.push(this.toFrontendNode(controller, { hasDetail: controllerHasDetail }));
    if (controllerHasDetail) {
      this.buildDetail(controller.id, orderedAdj, nodeMap, nodeDetails);
    }

    let prevId = controller.id;
    let globalStepCounter = 0;

    // Walk direct children of the controller in source order
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
    }

    return { nodes: rootNodes, edges: rootEdges };
  }

  /**
   * Build the drill-down layer for a node.
   *
   * Uses the same progressive-disclosure strategy as the root layer:
   *   1. Look for @FlowStep-annotated descendants → show as a clean numbered chain.
   *   2. If none found → fall back to depth-1 direct children (still drillable).
   *
   * This keeps every layer at roughly the same cognitive complexity regardless of depth.
   */
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

    // Sentinel before any recursive calls
    nodeDetails[startId] = { nodes: [], edges: [] };

    const resultNodes: FrontendNode[] = [];
    const resultEdges: FrontendEdge[] = [];
    const visited = new Set<string>([startId]);

    // Show all direct children in source order.
    // If a child has exactly 1 sub-child it is a pass-through — inline its
    // single descendant into the same layer instead of creating a drill layer.
    const directChildren = orderedAdj.get(startId) ?? [];

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
      // Drillable only when it has multiple children (pass-throughs are inlined)
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

      // Inline the single child transparently
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
    const prefix = controller.controllerPrefix ?? '';
    const methodPath = controller.routePath ?? controller.methodName;
    const full = methodPath ? `${prefix}/${methodPath}` : prefix;
    return full.startsWith('/') ? full : `/${full}`;
  }

  private toFrontendNode(
    node: FlowNode,
    opts: { hasDetail?: boolean; stepNumber?: number } = {},
  ): FrontendNode {
    return {
      id: node.id,
      type: node.customTag ? 'enhanced' : 'standard',
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
