# code-map — Product Improvement Plan

Full breakdown of every improvement identified during a deep codebase review.
Items are organized by priority tier. Cross-referenced with `todo.md`.

---

## Bugs — Fix First

### Method-name collision in edge resolution
**File:** `backend/packages/nestjs/src/ast/ast-parser.service.ts` — `buildGraph()`

`methodIndex` is a `Map<methodName, nodeId>`. When two classes both have a method named `findOne`, the second one silently overwrites the first. Every edge pointing to `findOne` resolves to the wrong node.

**Fix:** Replace the map key with `className#methodName` (or use the full node ID string directly).

---

### `engine.py` missing in Python package
**File:** `backend/packages/python/flow_map/__init__.py`

Imports `FlowMap` from `.engine`, but `engine.py` does not exist in the package. This makes the entire Python integration non-functional out of the box.

**Fix:** Implement `engine.py` with the FastAPI binding logic, mirroring the NestJS `FlowMapper` class.

---

### Gemini custom model ignored
**File:** `backend/packages/nestjs/src/nano-agent/nano-agent.service.ts` — `buildRequest()`

The Gemini URL is built as `` `${config.apiUrl}/${config.defaultModel}:generateContent?key=...` ``. The user-supplied `this.model` override is never used for Gemini, while it is respected for all other providers.

**Fix:** Use `this.model ?? config.defaultModel` in the Gemini URL construction, same as the OpenAI path.

---

### `rawBody` exposed on `/api/flow-map/graph`
**File:** `backend/packages/nestjs/src/sidecar/sidecar.service.ts`

The `/api/flow-map/graph` endpoint serves the full `FlowGraph` including every function's `rawBody` to any client that can reach port 4567. In a staging or shared environment, this leaks source code.

**Fix:** Strip `rawBody` from the HTTP response (keep it only in memory for AI enrichment). Add an `authToken` config option and log a loud warning if the sidecar is bound to a non-localhost interface.

---

### `mockData.ts` filename is misleading
**File:** `frontend/src/lib/mockData.ts`

This file contains live runtime types (`FlowNode`, `FlowEdge`, `ExecutionPath`, `NodeDetail`) — not mock data. The name causes confusion about whether these are fixtures or the real shape.

**Fix:** Rename to `types.ts` or `flow-types.ts` and update all imports.

---

## High Impact — Core Gaps

### Live file-watch mode (hot reload)
The graph is built once at startup. Editing a controller while the dev server is running leaves the canvas stale until the next restart.

**Plan:**
- Add `chokidar` as a dev dependency in the NestJS package
- Wire a watcher in `FlowMapper` that calls `this.service.buildAndServeGraph()` on `.ts` / `.js` file changes within `sourceRoot`
- Debounce with ~300ms to avoid thrashing on rapid saves
- Push updated data to the frontend via SSE (see next item)

---

### Server-Sent Events instead of polling
The frontend polls `/api/flow-map/status` every 2 seconds to detect when AI enrichment finishes. This is wasteful and adds up to a 2s lag. The same channel can carry graph-update events from watch mode.

**Plan:**
- Add `GET /api/flow-map/events` SSE endpoint in `SidecarService`
- Emit `{ type: "aiEnrichingDone" }` when background enrichment completes
- Emit `{ type: "graphUpdated" }` when watch mode triggers a rebuild
- Replace `useExecutionPaths` polling loop with an `EventSource` listener

---

### Plain Express.js / Fastify / Hono adapters
NestJS-only support blocks the majority of Node.js backends. Express alone accounts for the vast majority of Node.js API deployments.

**Plan:**
- Create a new package `backend/packages/express` (or a single adapter file)
- Expose `CodeMap.bind(app: Application, config?: FlowMapperConfig)` mirroring the FastAPI API
- Reuse the existing `AstParserService`, `FlowMapperService`, `SidecarService`, and `NanoAgentService` — they are already framework-agnostic
- Add Fastify and Hono as thin wrappers over the same core once Express is working

---

### Monorepo support
`sourceRoot` defaults to `process.cwd()`, which only works for single-package repos. NX, Turborepo, and pnpm workspace projects need to scan multiple `apps/` and `libs/` directories and merge the graphs.

**Plan:**
- Add `sourceRoots?: string[]` to `FlowMapperConfig` (takes precedence over `sourceRoot`)
- In `AstParserService.parse()`, walk each root separately and merge the resulting `FlowGraph` node and edge arrays before deduplication
- Prefix node IDs with the root index to avoid collisions across packages

---

## Medium Impact — UX Wins

### Group and filter endpoints in Switchboard
With 40+ endpoints, the horizontal tab bar becomes an unusable scrolling list with no structure.

**Plan:**
- Group tabs by `controllerPrefix` (e.g. `/users`, `/auth`, `/orders`)
- Add collapsible accordion sections or a left-sidebar controller list
- Add HTTP method filter toggles (GET / POST / PUT / DELETE / PATCH)
- Show a count badge per group: `UserController (7)`
- Persist the active filter to `localStorage`

---

### "Explain this flow" AI feature
New team members need to understand what a critical endpoint does. Reading the graph is faster than reading code, but an AI narrative would be even faster.

**Plan:**
- Add a "Explain" button to the endpoint header area in the app
- Collect all `aiSummary` values for the active execution path (root + drill layers)
- Send a structured prompt to the configured AI provider: "Explain what happens when `POST /users/login` is called, given these steps: ..."
- Stream the response into a slide-in panel on the right side of the canvas
- Cache by path endpoint + current graph hash

---

### Search AI summaries in command palette
The ⌘K palette searches only `funcName` and `fileName`. Developers often know the business intent ("where do we validate the token?") but not the function name.

**Plan:**
- Include `aiSummary` in the `SearchResultItem` `sublabel` field, or add it as a separate ranked search field
- Rank AI summary matches below exact/prefix name matches but above fuzzy file matches
- Show a `✦` indicator on results that matched via AI summary

---

### Graph diff / "what changed"
During code review or after a refactor, developers want to see which execution paths changed — not just which files.

**Plan:**
- Store a snapshot of the graph (node IDs + body hashes) after each successful build in `.flow-cache/snapshot.json`
- On the next build, diff the new graph against the snapshot
- Mark changed nodes with a blue border, new nodes with a `+` badge, and removed nodes as ghost outlines
- Expose a toggle in the UI: "Show diff"
- Optionally, diff against a specific git commit SHA via a config option

---

### "Open in GitHub" in editor picker
For code review workflows, "jump to GitHub" is more useful than "jump to local editor."

**Plan:**
- At startup, run `git remote get-url origin` and `git rev-parse HEAD` in `FlowMapper.init()`
- Store `repoUrl` and `commitSha` in the resolved config
- Expose them via a new `/api/flow-map/meta` endpoint
- Add `"github"` as an `EditorId` in `deep-link.ts` with URL format `https://github.com/<org>/<repo>/blob/<sha>/<relPath>#L<line>`
- Fall back gracefully if not in a git repo

---

### Minimap for large graphs
For endpoints with many nodes spread across drill levels, spatial orientation is lost.

**Plan:**
- Import `MiniMap` from `@xyflow/react` — it is already a dependency
- Render it conditionally when `activeNodes.length > 10`
- Style to match the dark theme: `nodeColor="#27272a"`, `maskColor="rgba(0,0,0,0.7)"`
- Position bottom-left so it does not overlap the copy button or Controls

---

## Lower Effort — High Delight

### Keyboard navigation on canvas
Developers hate leaving the keyboard.

**Plan:**
- On canvas focus, track the "selected" node index in state
- `→` / `Tab` — move to the next node in call order
- `←` / `Shift+Tab` — move to the previous node
- `Enter` — expand/collapse the focused node
- `D` — drill into the focused node (if `hasDetail`)
- `Backspace` or `U` — go up one drill level
- Show a subtle focus ring on the keyboard-selected node (using the existing `expandedNodeId` pattern)

---

### Prominent step-number badge on `@FlowStep` nodes
`stepNumber` is computed and stored but rendered nowhere on the canvas. The sequential story of the flow is invisible.

**Plan:**
- In `EnhancedNode`, render a small circular badge at the top-left corner with `stepNumber`
- Style: amber background, white number, same amber glow as the node border
- Use `SPRING_BADGE` transition so it animates in when the node mounts

---

### Snapshot / export mode
Sharing the graph with a stakeholder or embedding it in a PR should not require running the server.

**Plan:**
- Add a `code-map snapshot` CLI command (separate `bin/` entry in the NestJS package)
- Run `AstParserService.parse()` on the `sourceRoot` without starting the sidecar
- Output options: `--format html` (self-contained static file), `--format svg`, `--format json`
- The HTML export bundles a stripped-down version of the React Flow canvas as a static snapshot
- The JSON export is the raw `FrontendExecutionPath[]` — consumable in CI scripts

---

### Auto-suggest `@FlowStep` annotation candidates
Most developers will not know about `@FlowStep` until they need it. Proactively surfacing candidates lowers the barrier.

**Plan:**
- After the AST parse, score each service method by: has JSDoc (+2), called directly from a controller (+3), name contains domain keywords like `create`, `validate`, `issue`, `send`, `notify` (+1 each)
- Expose the top-N candidates via a new `/api/flow-map/suggestions` endpoint
- In the UI, add a "Suggested annotations" panel (collapsed by default, opened from the Switchboard right controls area)
- Each suggestion shows the function name, file, and a one-click copy of the decorator string

---

### Retry/backoff in NanoAgent
A single transient error in a batch silently drops the summary for that node forever (until the cache is cleared).

**Plan:**
- Wrap `axios.post()` in a retry loop with exponential backoff: delays of 1s, 2s, 4s (max 3 attempts)
- Only retry on `429 Too Many Requests` and `5xx` errors — fail fast on `4xx` auth errors
- Log each retry attempt at `warn` level with the attempt number and delay
- Add a per-provider rate-limit config (requests per minute) to throttle batches proactively

---

## Strategic / Longer-term

### VS Code extension
The distribution moat. Makes code-map part of the editor experience rather than a browser tab developers forget to open.

**Plan:**
- New package `vscode-extension/` in the repo
- Extension activates when a workspace has `@code-map/nestjs` or `code_map` in its dependencies
- Sidebar panel: tree view of all endpoints, clicking one opens the FlowCanvas in a WebView panel
- Inline CodeLens: above each controller method, show `📍 code-map: view execution path →`
- Status bar item showing the current endpoint being viewed on the canvas

---

### Runtime tracing mode
Static AST is fast but blind to dynamic dispatch, factory patterns, conditional branches, and third-party library internals.

**Plan:**
- Add an opt-in `enableTracing: true` config flag
- For Node.js: use `async_hooks` to intercept async call boundaries and record a call trace per request
- For Python: wrap FastAPI middleware to capture the actual call stack per request using `contextvars`
- Overlay the runtime trace on the static graph: highlight edges that were actually traversed (green), dim edges that were not (gray), annotate with call counts and timing
- Show a "Recorded X requests — showing hot paths" indicator

---

### Multi-service / distributed view
Microservice architectures hit a hard wall — the graph stops at every outbound HTTP or gRPC call.

**Plan:**
- Add a `registryUrl` config option — each code-map instance registers itself with a central registry on startup
- The registry stores `{ serviceId, baseUrl, graph }` for each registered instance
- The sidecar fetches peer graphs from the registry and stitches them together at known call boundaries (axios calls to known service base URLs, gRPC stubs)
- The frontend renders cross-service edges as dashed lines with a service-name label

---

### Performance overlay
Transforms code-map from a structural documentation tool into a performance debugging tool — the most compelling enterprise use case.

**Plan:**
- Add an optional OpenTelemetry SDK integration that reads span data from a configurable OTLP endpoint
- Map span `operation.name` to node IDs using the same `className#methodName` key
- Overlay P50 / P95 latency on each node as a color-coded badge (green < 50ms, yellow < 200ms, red > 200ms)
- Show a "Slowest path" highlight mode that dims all nodes except the critical path

---

### CI integration / PR diff comments
Make graph changes visible in pull requests without any manual steps.

**Plan:**
- Add a `code-map ci` CLI command that runs the AST scan and compares against a stored baseline
- Output a Markdown summary: new endpoints, removed endpoints, changed execution paths
- GitHub Actions integration: post the summary as a PR comment via the GitHub API
- Store the baseline graph JSON as a CI artifact keyed by the base branch

---

### GraphQL and WebSocket support
Non-REST APIs get nothing from code-map today.

**Plan:**
- Extend `AstParserService` to recognize `@Resolver()` and `@Query()` / `@Mutation()` decorators (NestJS GraphQL)
- Map each resolver field to an entry point node, same as HTTP controllers
- For WebSocket: recognize `@SubscribeMessage()` handlers in NestJS and FastAPI WebSocket routes
- Expose these in a separate "GraphQL" tab in the Switchboard alongside the REST endpoints
