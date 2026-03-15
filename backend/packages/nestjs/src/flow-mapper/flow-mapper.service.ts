import { FlowLogger } from '../logger/flow-logger';
import {
  FlowGraph,
  FlowNode,
  FrontendNode,
  FrontendEdge,
  FrontendExecutionPath,
  ResolvedFlowMapperConfig,
} from '../dto/flow-mapper-config.dto';
import { AstParserService } from '../ast/ast-parser.service';
import { CacheService } from '../cache/cache.service';
import { NanoAgentService } from '../nano-agent/nano-agent.service';
import { SidecarService } from '../sidecar/sidecar.service';
import { MAX_EXECUTION_DEPTH } from '../constants';

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

    // Build ordered adjacency: from → children sorted by their callOrder in source
    const orderedAdj = new Map<string, string[]>();
    const edgesByFrom = new Map<string, { to: string; callOrder: number }[]>();
    for (const edge of graph.edges) {
      if (!edgesByFrom.has(edge.from)) edgesByFrom.set(edge.from, []);
      edgesByFrom.get(edge.from)!.push({ to: edge.to, callOrder: edge.callOrder });
    }
    for (const [from, children] of edgesByFrom) {
      orderedAdj.set(
        from,
        children.sort((a, b) => a.callOrder - b.callOrder).map((c) => c.to),
      );
    }

    const entryPoints = graph.nodes.filter((n) => n.type === 'controller');
    if (entryPoints.length === 0) return this.fallbackSinglePath(graph);

    return entryPoints.map((controller) => {
      const pathNodeMap = new Map<string, FlowNode>();
      const pathEdges: FrontendEdge[] = [];

      // Ordered DFS: walk calls in source order, depth-limited, no re-expansion of already-visited nodes
      const dfs = (id: string, depth: number, callOrder: number, parentId: string | null): void => {
        const node = nodeMap.get(id);
        if (!node) return;

        const alreadyExpanded = pathNodeMap.has(id);
        pathNodeMap.set(id, node);

        if (parentId !== null) {
          pathEdges.push({ id: `${parentId}→${id}`, source: parentId, target: id, callOrder });
        }

        // Don't re-expand already-seen nodes or go past max depth — avoids spaghetti & cycles
        if (alreadyExpanded || depth >= MAX_EXECUTION_DEPTH) return;

        const children = orderedAdj.get(id) ?? [];
        children.forEach((childId, idx) => dfs(childId, depth + 1, idx, id));
      };

      dfs(controller.id, 0, 0, null);

      return {
        endpoint: this.resolveEndpoint(controller),
        method: controller.httpMethod ?? 'GET',
        nodes: [...pathNodeMap.values()].map((n) => this.toFrontendNode(n)),
        edges: pathEdges,
      };
    });
  }

  private resolveEndpoint(controller: FlowNode): string {
    if (controller.routePath) return controller.routePath;
    // Derive a readable path from the method name when no decorator path is present
    const name = controller.methodName;
    return `/${name.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`).replace(/^-/, '')}`;
  }

  private toFrontendNode(node: FlowNode): FrontendNode {
    return {
      id: node.id,
      type: node.customTag || node.aiSummary ? 'enhanced' : 'standard',
      funcName: node.methodName,
      fileName: node.filePath,
      line: node.lineNumber,
      intentTag: node.customTag,
      docstring: node.docstring,
      aiSummary: node.aiSummary,
    };
  }

  private fallbackSinglePath(graph: FlowGraph): FrontendExecutionPath[] {
    return [
      {
        endpoint: '/*',
        method: 'ALL',
        nodes: graph.nodes.map((n) => this.toFrontendNode(n)),
        edges: graph.edges.map((e) => ({
          id: `${e.from}→${e.to}`,
          source: e.from,
          target: e.to,
          callOrder: e.callOrder,
        })),
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
