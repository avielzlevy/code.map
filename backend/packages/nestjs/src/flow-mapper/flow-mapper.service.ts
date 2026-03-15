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
import { MAX_EXECUTION_DEPTH } from '../constants';

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

    if (this.config.enableAI && this.nanoAgent) {
      await this.enrichWithAiSummaries(graph);
    }

    const paths = this.buildExecutionPaths(graph);

    this.sidecar.updateGraph(graph);
    this.sidecar.updatePaths(paths);

    FlowLogger.info(LOGGER_CONTEXT, 'Graph built and served', {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      paths: paths.length,
    });
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

      // Collect @FlowStep-tagged descendants of this child, in DFS source order
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

  /**
   * Collect all @FlowStep-annotated nodes reachable from startId in DFS source order.
   * Does not re-visit already-visited nodes.
   */
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

  /**
   * Build the full internal call graph for a node (the detail / drill-down layer).
   * Recursively builds details for every drillable child, enabling infinite layers.
   * Cycle detection: a sentinel empty entry is set before expanding to prevent re-entrant calls.
   */
  private buildDetail(
    startId: string,
    orderedAdj: OrderedAdj,
    nodeMap: Map<string, FlowNode>,
    nodeDetails: Record<string, NodeDetail>,
  ): NodeDetail {
    // Return cached or sentinel (cycle guard)
    if (startId in nodeDetails) return nodeDetails[startId];

    const startNode = nodeMap.get(startId);
    if (!startNode) {
      nodeDetails[startId] = { nodes: [], edges: [] };
      return nodeDetails[startId];
    }

    // Set sentinel before expanding to prevent cycles
    nodeDetails[startId] = { nodes: [], edges: [] };

    const detailNodeMap = new Map<string, FlowNode>([[startId, startNode]]);
    const detailEdges: FrontendEdge[] = [];

    const expandChildren = (parentId: string, depth: number): void => {
      if (depth >= MAX_EXECUTION_DEPTH) return;

      const children = orderedAdj.get(parentId) ?? [];
      let prevInChain = parentId;

      for (let i = 0; i < children.length; i++) {
        const childId = children[i];
        const child = nodeMap.get(childId);
        if (!child) continue;

        const alreadyExpanded = detailNodeMap.has(childId);
        detailNodeMap.set(childId, child);

        detailEdges.push({
          id: `${prevInChain}→${childId}`,
          source: prevInChain,
          target: childId,
          callOrder: i,
          edgeType: i === 0 ? 'call' : 'step',
        });

        if (!alreadyExpanded) expandChildren(childId, depth + 1);
        prevInChain = childId;
      }
    };

    expandChildren(startId, 0);

    // Recursively build details for every drillable child we included
    for (const [id] of detailNodeMap) {
      if (id !== startId && (orderedAdj.get(id) ?? []).length > 0 && !(id in nodeDetails)) {
        this.buildDetail(id, orderedAdj, nodeMap, nodeDetails);
      }
    }

    const detail: NodeDetail = {
      nodes: [...detailNodeMap.values()].map((n) =>
        this.toFrontendNode(n, {
          hasDetail: n.id !== startId && (orderedAdj.get(n.id) ?? []).length > 0,
        }),
      ),
      edges: detailEdges,
    };

    nodeDetails[startId] = detail;
    return detail;
  }

  private resolveEndpoint(controller: FlowNode): string {
    if (controller.routePath) return controller.routePath;
    // Derive a readable path from the method name when no decorator path is present
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
    FlowLogger.info(LOGGER_CONTEXT, `Enriching ${graph.nodes.length} nodes with AI summaries`);

    for (const node of graph.nodes) {
      const hash = this.cache.hashBody(node.rawBody);
      const cached = this.cache.get(node.id, hash);

      if (cached) {
        node.aiSummary = cached;
        continue;
      }

      try {
        const summary = await this.nanoAgent!.summarize(node);
        node.aiSummary = summary;
        this.cache.set(node.id, hash, summary);
      } catch (err) {
        FlowLogger.warn(LOGGER_CONTEXT, 'AI summary failed for node, skipping', {
          nodeId: node.id,
          error: (err as Error).message,
        });
      }
    }
  }
}
