# code-map — Product Todo

---

## Bugs

- [ ] `buildRootLayer` in `flow-mapper.service.ts` incorrectly promotes `@FlowStep`-tagged nodes up to the root layer via `collectFlowSteps`. `@FlowStep` should have no structural effect on graph layout — it's only a label + visual marker. Remove the `collectFlowSteps` call and let the layer structure follow call graph depth naturally.
- [ ] **Method-name collision in edge resolution** — `AstParserService.buildGraph()` uses a plain `Map<methodName, nodeId>`. Methods with the same name across different classes overwrite each other, producing wrong edges. Replace key with `className#methodName`.
- [ ] **`engine.py` missing in Python package** — `flow_map/__init__.py` imports `FlowMap` from `.engine` but no `engine.py` exists. Blocks all Python users.
- [ ] **Gemini custom model ignored** — `NanoAgentService.buildRequest()` constructs the Gemini URL using `config.defaultModel` directly in the string, ignoring the user-supplied `model` override.
- [ ] **`rawBody` exposed on `/api/flow-map/graph`** — Full function bodies are served to any client that can reach port 4567. Add an auth token or IP-allowlist option and emit a loud warning when the sidecar is accessible from non-localhost addresses.
- [ ] **`mockData.ts` filename is misleading** — The file contains live runtime types, not mock data. Rename to `types.ts` or `flow-types.ts`.

---

## Features

- [ ] **Guide system** — graduation hat icon near the command palette. When clicked, starts an automatic guided tour that walks the user through the key interactions step by step (select a path, drill into a node, copy a flow, etc.)

---

## High Impact — Core Gaps

- [ ] **Live file-watch mode (hot reload)** — Add a chokidar watcher that calls `FlowMapper.rebuild()` on `.ts` file saves and pushes the updated graph to the frontend. The graph should never be stale while the dev server is running.
- [ ] **WebSocket / SSE push instead of polling** — Replace the 2-second `/status` poll with a Server-Sent Events stream so the UI reacts instantly when AI enrichment finishes. Also enables pushing graph updates from watch mode.
- [ ] **Plain Express.js / Fastify / Hono adapters** — NestJS-only blocks the majority of Node.js backends. Add a `CodeMap.bind(app)` API (mirroring the FastAPI integration) for plain Express, Fastify, and Hono.
- [ ] **Monorepo support** — Add a `sourceRoots: string[]` config option to scan multiple packages and stitch their graphs together. Required for NX, Turborepo, and pnpm workspace users.

---

## Medium Impact — UX Wins

- [ ] **Group and filter endpoints in Switchboard** — With 40+ endpoints the tab bar becomes unusable. Add grouping by controller/module and HTTP method toggles (GET / POST / PUT / DELETE). Show a count badge per group.
- [ ] **"Explain this flow" AI feature** — Let the user select an endpoint and ask the AI to explain the full execution path in plain English. Huge onboarding accelerator for new team members.
- [ ] **Search AI summaries in command palette** — Index `aiSummary` text in the ⌘K search so developers can navigate by business intent (e.g. "authenticate", "token") not just function names.
- [ ] **Graph diff / "what changed"** — Compare the current graph against a git commit or last snapshot. Highlight changed nodes, mark new nodes with a `+` badge, and show removed paths. Valuable for code review.
- [ ] **"Open in GitHub" in editor picker** — Auto-detect the git remote and current commit SHA and add a `https://github.com/<org>/<repo>/blob/<sha>/<file>#L<line>` option alongside the local editor links.
- [ ] **Minimap for large graphs** — React Flow has a built-in `MiniMap` component. Enable it when the active layer has more than ~10 nodes.

---

## Lower Effort — High Delight

- [ ] **Keyboard navigation on canvas** — `→` moves to the next node in the flow, `←` goes back, `Enter` expands/collapses, `D` drills into the selected node.
- [ ] **Prominent step-number badge on `@FlowStep` nodes** — `stepNumber` is already tracked but not visually prominent. Render it as a numbered pill badge (1, 2, 3…) directly on the node card.
- [ ] **Snapshot / export mode** — A CLI command that runs the AST scan without a running server and outputs a shareable static HTML file, a PNG/SVG of the graph, and raw JSON (for CI consumption).
- [ ] **Auto-suggest `@FlowStep` candidates** — Use the AI (or heuristics — JSDoc present, called from a controller, DB-adjacent name) to recommend which functions would benefit from a `@FlowStep` annotation. Surface these in a "Suggested annotations" panel.
- [ ] **No retry/backoff in NanoAgent** — Add exponential backoff with jitter for transient provider errors so a flaky network doesn't permanently lose summaries for a batch.

---

## Strategic / Longer-term

- [ ] **VS Code extension** — Inline sidebar panel showing the current file's functions in context of the execution graph. Click a function → highlights its node in the flow. The distribution moat.
- [ ] **Runtime tracing mode** — Complement the static AST view with an opt-in runtime tracer (`async_hooks` for Node, decorator interception for Python) that records actual call graphs from live requests and overlays them. Show "hot paths" vs "cold paths."
- [ ] **Multi-service / distributed view** — When Service A calls Service B via HTTP/gRPC, the graph hits a dead end. Build a federation mode where multiple code-map instances register with each other and link their graphs at API call boundaries.
- [ ] **Performance overlay** — Integrate with OpenTelemetry / Datadog APM to overlay P50/P95 latency on each node. Transforms code-map from a structural tool into a performance debugging tool.
- [ ] **CI integration / PR diff comments** — A CLI that runs the AST analysis in CI and posts a PR comment showing which execution paths changed, new endpoints added, and removed paths.
- [ ] **GraphQL and WebSocket support** — Extend the AST parser to recognize GraphQL resolvers and WebSocket event handlers so non-REST APIs get the same call-graph treatment.
