export type FlowNode = {
  id: string;
  type: "standard" | "enhanced";
  funcName: string;
  fileName: string;
  line: number;
  intentTag?: string;
  docstring?: string;
  aiSummary?: string;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  callOrder: number;
};

export type ExecutionPath = {
  endpoint: string;
  method: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
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
        docstring: "/**\n * Registers a new user.\n * @param req The HTTP request\n * @param res The HTTP response\n */",
        aiSummary: "Parses request body, validates DTO, and delegates to UserService. Handles HTTP response formatting.",
      },
      {
        id: "svc-create",
        type: "enhanced",
        funcName: "createUser",
        fileName: "/src/services/user.service.ts",
        line: 45,
        intentTag: "@DomainLogic(Critical)",
        docstring: "/**\n * Core business logic for user creation.\n * Hashes password, saves to DB, and fires welcome event.\n */",
        aiSummary: "The primary domain service for user registration. Coordinates password hashing, database insertion via UserRepository, and triggers the asynchronous EmailService.",
      },
      {
        id: "repo-save",
        type: "standard",
        funcName: "save",
        fileName: "/src/repositories/user.repository.ts",
        line: 112,
        docstring: "/**\n * Persists a user entity to the database.\n */",
        aiSummary: "Executes an INSERT query to the users table using TypeORM.",
      },
      {
        id: "svc-email",
        type: "standard",
        funcName: "sendWelcomeEmail",
        fileName: "/src/services/email.service.ts",
        line: 18,
        docstring: "/**\n * Sends a template-based welcome email.\n */",
        aiSummary: "Dispatches an email request to SendGrid API with the 'welcome' template ID.",
      },
    ],
    edges: [
      { id: "e1", source: "ctrl-register", target: "svc-create", callOrder: 0 },
      { id: "e2", source: "svc-create", target: "repo-save", callOrder: 0 },
      { id: "e3", source: "svc-create", target: "svc-email", callOrder: 1 },
    ],
  },
  {
    endpoint: "/orders/checkout",
    method: "POST",
    nodes: [
      {
        id: "ctrl-checkout",
        type: "standard",
        funcName: "processCheckout",
        fileName: "/src/controllers/order.controller.ts",
        line: 55,
        docstring: "/**\n * Starts the checkout process.\n */",
        aiSummary: "Extracts cart ID and payment details, routes to OrderService.",
      },
      {
        id: "svc-payment",
        type: "enhanced",
        funcName: "processPayment",
        fileName: "/src/services/payment.service.ts",
        line: 88,
        intentTag: "@ExternalIntegration(Stripe)",
        docstring: "/**\n * Communicates with Stripe to capture funds.\n */",
        aiSummary: "Calls Stripe API to create a PaymentIntent and confirms it. Synchronous blocking call.",
      }
    ],
    edges: [
      { id: "e4", source: "ctrl-checkout", target: "svc-payment", callOrder: 0 }
    ]
  }
];
