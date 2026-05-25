export type FlowNode = {
  id: string;
  type: "standard" | "enhanced";
  funcName: string;
  fileName: string;
  line: number;
  intentTag?: string;
  docstring?: string;
  aiSummary?: string;
  hasDetail: boolean;
  stepNumber?: number;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  callOrder: number;
  edgeType: "call" | "step";
};

export type NodeDetail = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type ExecutionPath = {
  endpoint: string;
  method: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  nodeDetails: Record<string, NodeDetail>;
};

// ── Raw graph types — returned by /api/flow-map/graph (rawBody stripped) ──────
// These are the parser-level types, distinct from the canvas-ready FlowNode above.

export type RawGraphNode = {
  id: string;
  label: string;
  methodName: string;
  /** Parser-level classification — superset of the canvas "standard/enhanced" split. */
  type: string;
  filePath: string;
  lineNumber: number;
  docstring?: string;
  aiSummary?: string;
  customTag?: string;
  httpMethod?: string;
  routePath?: string;
  controllerPrefix?: string;
};

export type RawGraphEdge = {
  from: string;
  to: string;
  callOrder: number;
};

export type RawGraph = {
  nodes: RawGraphNode[];
  edges: RawGraphEdge[];
  generatedAt: string;
};

export type GitInfo = {
  githubBaseUrl: string | null;
  sha: string | null;
  root: string;
};

// ── Guide artifact (mirrors the backend GuideArtifact) ──────────────────────
// Ids and file paths are repo-relative so the file is portable across machines.

export type GuideCommit = {
  hash: string;
  subject: string;
};

export type GuideChangeType = "added" | "edited" | "removed";

export type GuideStep = {
  nodeId: string;
  methodName: string;
  file: string;
  type: "controller" | "service" | "utility" | "unknown";
  changeType: GuideChangeType;
  explanation: string;
};

export type GuideSubgraphNode = {
  id: string;
  label: string;
  methodName: string;
  type: GuideStep["type"];
  file: string;
  line: number;
  role: "changed" | "context";
};

export type GuideArtifact = {
  meta: {
    base: string;
    head: string;
    generatedAt: string;
    commits: GuideCommit[];
  };
  steps: GuideStep[];
  subgraph: {
    nodes: GuideSubgraphNode[];
    edges: { from: string; to: string; callOrder: number }[];
  };
};
