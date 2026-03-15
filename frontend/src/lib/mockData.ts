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

export const MOCK_PATHS: ExecutionPath[] = [
  {
    endpoint: "/users/register",
    method: "POST",
    nodes: [
      {
        id: "ctrl-register",
        type: "standard",
        funcName: "registerUser",
        fileName: "/src/controllers/user.controller.ts",
        line: 24,
        hasDetail: true,
        docstring: "Registers a new user.",
      },
      {
        id: "svc-create",
        type: "enhanced",
        funcName: "createUser",
        fileName: "/src/services/user.service.ts",
        line: 45,
        intentTag: "Validate DTO, hash password, persist user, fire welcome event",
        hasDetail: true,
        stepNumber: 1,
      },
      {
        id: "svc-email",
        type: "enhanced",
        funcName: "sendWelcomeEmail",
        fileName: "/src/services/email.service.ts",
        line: 18,
        intentTag: "Dispatch welcome email via SendGrid template",
        hasDetail: false,
        stepNumber: 2,
      },
    ],
    edges: [
      { id: "e1", source: "ctrl-register", target: "svc-create", callOrder: 0, edgeType: "call" },
      { id: "e2", source: "svc-create", target: "svc-email", callOrder: 1, edgeType: "step" },
    ],
    nodeDetails: {
      "ctrl-register": {
        nodes: [
          { id: "ctrl-register", type: "standard", funcName: "registerUser", fileName: "/src/controllers/user.controller.ts", line: 24, hasDetail: false },
          { id: "svc-create-detail", type: "standard", funcName: "createUser", fileName: "/src/services/user.service.ts", line: 45, hasDetail: false },
        ],
        edges: [
          { id: "d-e1", source: "ctrl-register", target: "svc-create-detail", callOrder: 0, edgeType: "call" },
        ],
      },
      "svc-create": {
        nodes: [
          { id: "svc-create", type: "enhanced", funcName: "createUser", fileName: "/src/services/user.service.ts", line: 45, hasDetail: false },
          { id: "repo-save", type: "standard", funcName: "save", fileName: "/src/repositories/user.repository.ts", line: 112, hasDetail: false },
          { id: "svc-email-detail", type: "standard", funcName: "sendWelcomeEmail", fileName: "/src/services/email.service.ts", line: 18, hasDetail: false },
        ],
        edges: [
          { id: "d-e2", source: "svc-create", target: "repo-save", callOrder: 0, edgeType: "call" },
          { id: "d-e3", source: "repo-save", target: "svc-email-detail", callOrder: 1, edgeType: "step" },
        ],
      },
    },
  },
];
