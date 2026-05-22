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

export type GuideStep = {
  nodeId: string;
  methodName: string;
  file: string;
  type: "controller" | "service" | "utility" | "unknown";
  lineRange: [number, number];
  status: "modified";
  narration: string;
  diff: string;
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
