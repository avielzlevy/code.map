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
    const adjacency = new Map<string, string[]>();

    for (const edge of graph.edges) {
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
      adjacency.get(edge.from)!.push(edge.to);
    }

    const entryPoints = graph.nodes.filter((n) => n.type === 'controller');

    if (entryPoints.length === 0) {
      return this.fallbackSinglePath(graph);
    }

    return entryPoints.map((controller) => {
      const visited = this.bfsReachable(controller.id, adjacency);
      const pathNodes = [...visited].map((id) => nodeMap.get(id)!).filter(Boolean);
      const pathEdges: FrontendEdge[] = graph.edges
        .filter((e) => visited.has(e.from) && visited.has(e.to))
        .map((e) => ({ id: `${e.from}→${e.to}`, source: e.from, target: e.to }));

      return {
        endpoint: this.resolveEndpoint(controller),
        method: controller.httpMethod ?? 'GET',
        nodes: pathNodes.map((n) => this.toFrontendNode(n)),
        edges: pathEdges,
      };
    });
  }

  private bfsReachable(startId: string, adjacency: Map<string, string[]>): Set<string> {
    const visited = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const next of adjacency.get(id) ?? []) {
        queue.push(next);
      }
    }

    return visited;
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
