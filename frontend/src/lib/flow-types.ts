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
