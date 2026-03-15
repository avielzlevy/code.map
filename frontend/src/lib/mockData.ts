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
        id: "router-register",
        type: "standard",
        funcName: "UserRouter.post('/register')",
        fileName: "/src/routes/user.routes.ts",
        line: 12,
        hasDetail: false,
        docstring: "Route definition for user registration endpoints. Maps to the UserController.",
      },
      {
        id: "ctrl-register",
        type: "enhanced",
        funcName: "registerUser",
        fileName: "/src/controllers/user.controller.ts",
        line: 24,
        intentTag: "Handle HTTP request and coordinate user creation",
        hasDetail: true,
        aiSummary: "This controller method validates the incoming HTTP request payload and delegates the core business logic to the UserService. It handles sending the appropriate HTTP response back to the client once the operation completes.",
      },
    ],
    edges: [
      { id: "e1", source: "router-register", target: "ctrl-register", callOrder: 0, edgeType: "call" },
    ],
    nodeDetails: {
      "ctrl-register": {
        nodes: [
          {
             id: "dto-validate",
             type: "standard",
             funcName: "validateDto",
             fileName: "/src/middleware/validate.ts",
             line: 15,
             hasDetail: false,
             docstring: "Validates incoming request payload against Zod schema to prevent malformed data entering the core logic."
          },
          {
             id: "svc-create",
             type: "enhanced",
             funcName: "createUser",
             fileName: "/src/services/user.service.ts",
             line: 45,
             intentTag: "Core business logic for creating a user",
             hasDetail: true,
             aiSummary: "The UserService handles the heavy lifting: securing the password, persisting the record to the database via the repository, and triggering asynchronous side effects like welcome emails."
          }
        ],
        edges: [
          { id: "d1-e1", source: "dto-validate", target: "svc-create", callOrder: 0, edgeType: "step" }
        ],
      },
      "svc-create": {
        nodes: [
          {
             id: "util-hash",
             type: "standard",
             funcName: "hashPassword",
             fileName: "/src/utils/crypto.ts",
             line: 8,
             hasDetail: false,
             docstring: "Hashes a plaintext password using bcrypt with a cost factor of 12."
          },
          {
             id: "repo-save",
             type: "standard",
             funcName: "UserRepository.save",
             fileName: "/src/repositories/user.repository.ts",
             line: 112,
             hasDetail: false,
             docstring: "Executes the INSERT SQL query to store the new user record in the PostgreSQL database."
          },
          {
             id: "svc-email",
             type: "standard",
             funcName: "sendWelcomeEmail",
             fileName: "/src/services/email.service.ts",
             line: 18,
             hasDetail: false,
             docstring: "Pushes a welcome email job to the background queue (BullMQ/Redis)."
          }
        ],
        edges: [
          { id: "d2-e1", source: "util-hash", target: "repo-save", callOrder: 0, edgeType: "step" },
          { id: "d2-e2", source: "repo-save", target: "svc-email", callOrder: 1, edgeType: "step" }
        ]
      }
    }
  },
  {
    endpoint: "/orders/checkout",
    method: "POST",
    nodes: [
      {
        id: "router-checkout",
        type: "standard",
        funcName: "OrderRouter.post('/checkout')",
        fileName: "/src/routes/order.routes.ts",
        line: 34,
        hasDetail: false,
        docstring: "Exposes the checkout endpoint to clients."
      },
      {
        id: "ctrl-checkout",
        type: "enhanced",
        funcName: "processCheckout",
        fileName: "/src/controllers/order.controller.ts",
        line: 88,
        intentTag: "Process user cart and finalize order",
        hasDetail: true,
        aiSummary: "Orchestrates the complex order checkout process, coordinating between inventory checks, payment processing, and final order creation in the local database."
      }
    ],
    edges: [
      { id: "e-chk-1", source: "router-checkout", target: "ctrl-checkout", callOrder: 0, edgeType: "call" }
    ],
    nodeDetails: {
      "ctrl-checkout": {
        nodes: [
          {
            id: "svc-inventory",
            type: "standard",
            funcName: "verifyInventory",
            fileName: "/src/services/inventory.service.ts",
            line: 42,
            hasDetail: false,
            docstring: "Checks current stock levels in Redis to ensure items are available before charging the customer."
          },
          {
            id: "svc-payment",
            type: "enhanced",
            funcName: "chargeCard",
            fileName: "/src/services/payment.service.ts",
            line: 105,
            intentTag: "Interact with Stripe API to capture funds",
            hasDetail: true,
            aiSummary: "Handles the integration with the external Stripe API to securely charge the customer's vaulted credit card. Manages complex 3D-Secure flows and webhooks if required."
          },
          {
            id: "repo-order",
            type: "standard",
            funcName: "OrderRepository.create",
            fileName: "/src/repositories/order.repository.ts",
            line: 210,
            hasDetail: false,
            docstring: "Persists the completed order to the database and marks the cart as fulfilled."
          }
        ],
        edges: [
          { id: "d-chk-1", source: "svc-inventory", target: "svc-payment", callOrder: 0, edgeType: "step" },
          { id: "d-chk-2", source: "svc-payment", target: "repo-order", callOrder: 1, edgeType: "step" }
        ]
      },
      "svc-payment": {
        nodes: [
          {
            id: "stripe-charge",
            type: "standard",
            funcName: "stripe.paymentIntents.create",
            fileName: "node_modules/stripe/lib/resources/PaymentIntents.js",
            line: 15,
            hasDetail: false,
            docstring: "External call to the Stripe SDK to initialize a PaymentIntent."
          }
        ],
        edges: []
      }
    }
  },
  {
    endpoint: "/health",
    method: "GET",
    nodes: [
      {
        id: "router-health",
        type: "standard",
        funcName: "HealthRouter.get('/')",
        fileName: "/src/routes/health.routes.ts",
        line: 5,
        hasDetail: false,
      },
      {
        id: "ctrl-health",
        type: "standard",
        funcName: "checkHealth",
        fileName: "/src/controllers/health.controller.ts",
        line: 12,
        hasDetail: false,
        docstring: "Pings the database and Redis cache to verify system health. Returns 200 OK if all subsystems are operational."
      }
    ],
    edges: [
      { id: "e-hlth-1", source: "router-health", target: "ctrl-health", callOrder: 0, edgeType: "call" }
    ],
    nodeDetails: {}
  }
];
