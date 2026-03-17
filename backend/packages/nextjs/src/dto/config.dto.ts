import { AIProvider } from '../constants';

type FlowMapBaseConfig = {
  /** Port for the sidecar visualization server. Defaults to 4567. */
  port?: number;
  /** File system path for the AI summary cache directory. Defaults to .flow-cache in cwd. */
  cachePath?: string;
  /** Root directory to scan for source files. Defaults to process.cwd(). */
  sourceRoot?: string;
};

export type FlowMapConfig = FlowMapBaseConfig &
  (
    | { enableAI: true; apiKey: string; provider: AIProvider; model?: string }
    | { enableAI?: false; apiKey?: string; provider?: AIProvider; model?: string }
  );

export interface ResolvedFlowMapConfig {
  port: number;
  enableAI: boolean;
  apiKey: string;
  provider: AIProvider | '';
  model: string | undefined;
  cachePath: string;
  sourceRoot: string;
}

export interface FlowNode {
  id: string;
  label: string;
  methodName: string;
  type: 'controller' | 'service' | 'utility' | 'unknown';
  filePath: string;
  lineNumber: number;
  docstring?: string;
  rawBody: string;
  aiSummary?: string;
  customTag?: string;
  httpMethod?: string;
  routePath?: string;
}

/** Frontend-ready types — matches the shape expected by the React visualiser. */
export interface FrontendNode {
  id: string;
  type: 'standard' | 'enhanced';
  funcName: string;
  fileName: string;
  line: number;
  intentTag?: string;
  docstring?: string;
  aiSummary?: string;
  /** True when this node has an expanded detail graph available. */
  hasDetail: boolean;
  /** Sequential position within a step chain (1-based), shown as a badge. */
  stepNumber?: number;
}

export interface FrontendEdge {
  id: string;
  source: string;
  target: string;
  callOrder: number;
  /** 'call' = parent invokes child; 'step' = sequential next call in same function body */
  edgeType: 'call' | 'step';
}

export interface NodeDetail {
  nodes: FrontendNode[];
  edges: FrontendEdge[];
}

export interface FrontendExecutionPath {
  endpoint: string;
  method: string;
  /** Root layer: route handler → service → @FlowStep nodes only. */
  nodes: FrontendNode[];
  edges: FrontendEdge[];
  /** Full internal call graph for each drillable node, keyed by node id. */
  nodeDetails: Record<string, NodeDetail>;
}

export interface FlowEdge {
  from: string;
  to: string;
  callOrder: number;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  generatedAt: string;
}

export interface CacheEntry {
  bodyHash: string;
  summary: string;
  cachedAt: string;
}

export interface CacheIndex {
  [nodeId: string]: CacheEntry;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  meta?: Record<string, unknown>;
}
