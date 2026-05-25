<p align="center">
  <img src="frontend/public/code.map-logo.png" alt="code.map" width="400" />
</p>

<h1 align="center">code.map</h1>

<p align="center">
  <em>Interactive API execution graph for TypeScript and Python — see your full call chain in seconds</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@code-map/nestjs"><img src="https://img.shields.io/npm/v/@code-map/nestjs?style=flat-square&label=%40code-map%2Fnestjs&color=white" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@code-map/node"><img src="https://img.shields.io/npm/v/@code-map/node?style=flat-square&label=%40code-map%2Fnode&color=white" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@code-map/nextjs"><img src="https://img.shields.io/npm/v/@code-map/nextjs?style=flat-square&label=%40code-map%2Fnextjs&color=white" alt="npm version"></a>
  <a href="https://pypi.org/project/code-map/"><img src="https://img.shields.io/pypi/v/code-map?style=flat-square&label=code-map&color=white" alt="PyPI version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-white?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#contributing">Contributing</a>
</p>

<div align="center">
  <video src="https://github.com/user-attachments/assets/127de087-012c-4e6b-a568-7e234b3af33a" width="100%" controls muted></video>
</div>

code.map instruments your TypeScript or Python app and renders the full execution path — from route handler down to every service call — as an interactive call graph. Drop it into any supported framework, open your browser, and your codebase becomes a map.

It's a zero-configuration sidecar: add one module, get a live visualization at `localhost:4567`. No rebuild, no separate process. Optional AI summaries annotate each node with a plain-English intent label — run locally with Ollama or against any major provider (Anthropic, OpenAI, Google, OpenRouter) — cached after first run.

## Features

- **Instant call graphs** — Select any endpoint and the full execution path renders as a directed graph, laid out automatically with dagre
- **Full-stack entry points** — HTTP controllers, workers, queue consumers (`@Process`, `@EventPattern`), scheduled tasks (`@Cron`, `@Interval`), and `main.ts`/`bootstrap()` functions all appear as first-class roots
- **Orphan node search** — Functions unreachable via static analysis (factory-pattern DI, dynamic dispatch) surface in `⌘K` under "Unreachable functions" with a depth-1 neighborhood view
- **Drill-down navigation** — Click any node to expand one level deeper; breadcrumbs let you navigate back up
- **VS Code deep links** — Every node links directly to the exact source file and line number
- **Command palette** — `⌘K` to search endpoints, workers, and all functions across the entire parsed graph
- **AI intent summaries** — Optional LLM integration (Anthropic, OpenAI, Google, OpenRouter, or local Ollama) annotates each function with a 10-word plain-English summary, cached in `.flow-cache/` after first run
- **`@Dot` decorator** — Tag critical functions with a business-intent label that appears inline on the graph node
- **Guide walkthroughs** — Author step-by-step guides with your coding agent; play them back on the live graph — including orphan nodes — with `/codemap-guide`
- **Zero-config sidecar** — Spawns an Express server alongside your app; no separate process or infrastructure needed
- **Spring-physics UI** — Every transition uses spring curves — nothing snaps

## Quick Start

### Install with an agent (recommended)

Paste this prompt to your coding agent (Claude Code, Cursor, etc.). It detects your framework, asks how you want AI summaries set up, installs and wires in code.map, and installs the `/codemap-*` skills globally.

```text
Set up code-map (https://github.com/avielzlevy/code-map) in this project — a dev tool
that renders my API's execution graph at http://localhost:4567.

1. Detect my framework from the manifest:
   - NestJS  → "@nestjs/core" in package.json  → use @code-map/nestjs
   - Next.js → "next" in package.json           → use @code-map/nextjs
   - FastAPI → "fastapi" in requirements.txt / pyproject.toml → use code-map (PyPI)
   - Other Node.js (Express, Fastify, plain scripts, workers) → use @code-map/node
   If it's none of the above, stop and tell me.

2. ASK ME whether I want AI summaries, and WAIT for my answer. Explain the trade-off:
   - Summaries annotate each function with a one-line plain-English intent label.
   - They are CACHED in .flow-cache/ and INCREMENTAL: a summary is generated the first
     time a function is seen and only re-generated when that function's body changes —
     a one-time cost per function, not per run.
   - Options:
       • Off    — no LLM, just the structural graph (fastest).
       • Local  — Ollama on my machine, no API key, free (requires Ollama installed).
       • Remote — Anthropic / OpenAI / Google / OpenRouter; needs an API key.

3. Install the package for my framework:
   - NestJS:      npm install @code-map/nestjs
   - Next.js:     npm install @code-map/nextjs
   - Other Node:  npm install @code-map/node
   - FastAPI:     pip install code-map

4. Wire it in, GUARDED FOR DEVELOPMENT ONLY (never in production):
   - NestJS  — in app.module.ts add CodeMapModule.forRoot({ port: 4567, ...ai }) to imports.
   - Next.js — wrap next.config.ts with withCodeMap(nextConfig, { port: 4567, ...ai });
               add instrumentation.ts at the project root with: await CodeMap.init()
   - Node.js — in the entry file: await CodeMap.init(app, { port: 4567, ...ai })
               Pass null instead of app for worker scripts with no HTTP server.
   - FastAPI — in the app entry: CodeMap.bind(app, config={"port": 4567, ...ai}).
   Apply my AI choice as ...ai:
       • Off    → no AI fields.
       • Local  → NestJS/Node: enableAI: true, provider: 'ollama'
                  FastAPI: "enable_ai": True, "provider": "ollama"
       • Remote → NestJS/Node: enableAI: true, provider: '<provider>', apiKey: process.env.<KEY>
                  FastAPI: "enable_ai": True, "provider": "<provider>", "api_key": os.environ["<KEY>"]
                  and tell me which env var to set.

5. Install the code-map skills globally so I can use them from any project:
   mkdir -p ~/.claude/skills/codemap-guide ~/.claude/skills/codemap-x
   curl -fsSL https://raw.githubusercontent.com/avielzlevy/code-map/main/.claude/skills/codemap-guide/SKILL.md \
     -o ~/.claude/skills/codemap-guide/SKILL.md
   curl -fsSL https://raw.githubusercontent.com/avielzlevy/code-map/main/.claude/skills/codemap-x/SKILL.md \
     -o ~/.claude/skills/codemap-x/SKILL.md

6. Explain the skills to me:
   - /codemap-guide — after we work through a change together, it authors a step-by-step
     walkthrough of what we changed (which functions, and why), saves it to .codemap/guides/,
     and opens it in code-map so I can replay the change on the visual graph. It's shareable —
     commit it or send the URL.
   - /codemap-x — finds the important, under-documented functions using the live code-map graph
     (not by reading my whole codebase), then proposes JSDoc/docstrings and @Dot intent labels
     for the entry points and high-traffic functions that carry the most signal — so the map
     reads like a story.

Finally, start my app and tell me to open http://localhost:4567.
```

Prefer to do it by hand? Follow the framework-specific steps below.

### NestJS

Requires Node.js ≥ 18 and NestJS ≥ 10.

```bash
npm install @code-map/nestjs
```

```typescript
// app.module.ts
import { CodeMapModule } from '@code-map/nestjs';

@Module({
  imports: [
    CodeMapModule.forRoot({ port: 4567 }),
    // ...your other modules
  ],
})
export class AppModule {}
```

Start your app, then open **http://localhost:4567**.

---

### Node.js (Express, Fastify, workers, CLI scripts)

Use `@code-map/node` for any Node.js project that isn't NestJS — Express/Fastify APIs, queue workers, schedulers, or plain scripts.

Requires Node.js ≥ 18.

```bash
npm install @code-map/node
```

**With an HTTP server (Express / Fastify):**

```typescript
// main.ts
import { CodeMap } from '@code-map/node';
import app from './app';

await CodeMap.init(app, { port: 4567 });
```

**Worker / CLI script (no HTTP server):**

```typescript
// worker.ts
import { CodeMap } from '@code-map/node';

await CodeMap.init(null, { port: 4568 });

// ...your worker logic
```

Start your script, then open **http://localhost:4567** (or whichever port you chose).

> [!NOTE]
> One instance is enough for a Node.js monorepo — code.map scans `sourceRoot` and detects all services, workers, and controllers from a single process. You only need a second instance if you're mixing runtimes (e.g., a Node.js service alongside a Python service).

---

### Next.js

Requires Node.js ≥ 18 and Next.js ≥ 13 (App Router).

```bash
npm install @code-map/nextjs
```

**Step 1 — wrap your Next.js config:**

```typescript
// next.config.ts
import { withCodeMap } from '@code-map/nextjs';

const nextConfig = {
  // ...your existing config
};

export default withCodeMap(nextConfig, { port: 4567 });
```

**Step 2 — start the sidecar in the instrumentation hook:**

```typescript
// instrumentation.ts  (create at the project root if it doesn't exist)
import { CodeMap } from '@code-map/nextjs';

export async function register() {
  await CodeMap.init();
}
```

Start your app, then open **http://localhost:4567**.

---

### FastAPI

Requires Python ≥ 3.9 and FastAPI ≥ 0.100.

```bash
pip install code-map
```

```python
# main.py
from fastapi import FastAPI
from code_map import CodeMap

app = FastAPI()
CodeMap.bind(app, config={"port": 4567})
```

Start your app, then open **http://localhost:4567**.

---

You'll see the code.map UI. Select an endpoint, worker, or scheduled job from the nav bar — your full execution graph appears on the canvas.

> [!NOTE]
> code.map is a development tool. Guard the import behind `process.env.NODE_ENV !== 'production'` (Node.js) or an equivalent env check before deploying.

## Usage

### Navigating the canvas

The top nav bar groups your entry points by **resource** or **HTTP method**. Both dropdowns are scrollable for large monorepos. The currently selected path is always shown inline in the bar.

Use `⌘K` to search across all endpoints, workers, scheduled tasks, and every function in the parsed graph — including functions that don't appear in any execution path (see [Orphan nodes](#orphan-nodes) below).

### Orphan nodes

Some functions can't be reached by static analysis — dependency injection containers, factory patterns, and dynamic dispatch all produce call edges that the AST parser can't trace. These nodes are still valuable: you can find them in the command palette under **"Unreachable functions"**.

Selecting an orphan opens a **neighborhood view** — a synthetic path showing the node plus its immediate callers and callees (depth 1). A banner at the top of the canvas identifies the view as a graph neighborhood, not a full execution path.

Guide walkthroughs also navigate to orphan nodes correctly; the same neighborhood view is shown when a guide step points to a node outside the rendered paths.

### Annotating key functions with `@Dot`

Mark important functions with a business-intent label. It renders as an amber pill directly on the graph node.

**NestJS / Node.js:**

```typescript
import { Dot } from '@code-map/nestjs'; // or '@code-map/node'

@Injectable()
export class OrderService {
  @Dot('Validate cart and apply discounts')
  async processCheckout(cartId: string) {
    // ...
  }
}
```

**FastAPI:**

```python
from code_map import dot

@dot("Validate cart and apply discounts")
async def process_checkout(cart_id: str):
    # ...
```

### Worker and queue entry points

code.map automatically detects non-HTTP entry points and renders them as graph roots alongside your HTTP controllers:

| Decorator / pattern | Detected as |
|---|---|
| `@Controller` | HTTP controller |
| `@Cron`, `@Interval`, `@Timeout` | Scheduled task |
| `@Process`, `@EventPattern`, `@MessagePattern`, `@GrpcMethod` | Queue / message handler |
| `main()`, `bootstrap()`, `CodeMap.init(null, …)` | Worker entry point |

Each distinct entry point becomes a selectable path in the nav bar. A monorepo with both an HTTP API and a BullMQ worker will show all of them.

### Guide walkthroughs

After working through a change with your coding agent, run `/codemap-guide` in Claude Code. The skill authors a step-by-step walkthrough — which functions changed and why — saves it to `.codemap/guides/`, and hands you a URL that opens the walkthrough on the live graph. Each step pans to the node, colors it by change type (added / edited / removed), and shows the explanation inline.

Guides navigate the full graph — including orphan nodes — and are portable JSON files you can commit or share with your team.

### Enabling AI summaries

Pass an API key to have an LLM generate plain-English summaries for every function in the graph. Summaries are cached in `.flow-cache/` after the first run, keyed by function body hash.

**NestJS / Node.js:**

```typescript
CodeMapModule.forRoot({
  port: 4567,
  enableAI: true,
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// or with @code-map/node:
await CodeMap.init(app, {
  port: 4567,
  enableAI: true,
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

**FastAPI:**

```python
CodeMap.bind(app, config={
    "port": 4567,
    "enable_ai": True,
    "api_key": os.environ["ANTHROPIC_API_KEY"],
})
```

You can also set your API key and provider via the `SUMMARIES_API_KEY` and `SUMMARIES_PROVIDER` environment variables instead of passing them in config.

**Local, no API key (Ollama):** run summaries entirely on your machine — no key, no data leaves your laptop. Requires [Ollama](https://ollama.com) running locally.

```typescript
CodeMapModule.forRoot({ port: 4567, enableAI: true, provider: 'ollama' })
```

Summaries are cached in `.flow-cache/` and regenerated incrementally — only when a function's body changes — so it's a one-time cost per function, not per run.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4567` | Port for the sidecar server |
| `enableAI` / `enable_ai` | `boolean` | `false` | Generate AI summaries |
| `apiKey` / `api_key` | `string` | `SUMMARIES_API_KEY` env var | API key for the chosen provider (required when AI is enabled) |
| `provider` | `string` | `SUMMARIES_PROVIDER` env var | LLM provider: `anthropic`, `openai`, `google`, `openrouter` (API key required), or `ollama` (local, no key) |
| `cachePath` / `cache_path` | `string` | `.flow-cache` | Directory for cached AI summaries |
| `sourceRoot` / `source_root` | `string` | `process.cwd()` | Root directory scanned for source files |

## How It Works

code.map runs as a lightweight sidecar alongside your application:

1. **At startup** — The AST parser walks your source directory and builds a call graph by statically analyzing class declarations, method signatures, and decorators. It classifies each node as a controller, worker entry, scheduler, queue handler, service, or utility.
2. **Entry-point routing** — The service identifies all roots (controllers, workers, schedulers, queue handlers) and builds a separate execution path from each. If no classified entry points exist, it falls back to nodes with no incoming edges.
3. **At runtime** — The sidecar serves the graph over a local HTTP server. The full graph is also exposed for search, so every node is reachable via `⌘K` regardless of whether it appears in an execution path.
4. **In the browser** — The frontend fetches the graph, lays it out with dagre, and renders it with React Flow and spring-physics animations.
5. **On demand** — Clicking a node fetches its detail subgraph (one level deep); VS Code links open the source file at the exact line. Orphan nodes render a depth-1 neighborhood instead of a full path.

The maximum traced depth is 4 call levels. Excluded from analysis: `node_modules`, `dist`, `.git`, `coverage`, `__tests__`.

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change, then submit a PR against `main`.

The repo is a monorepo:

```
code-map/
├── frontend/          # Next.js UI
└── backend/
    └── packages/
        ├── nestjs/    # @code-map/nestjs  (NestJS module)
        ├── node/      # @code-map/node    (framework-agnostic Node.js SDK)
        ├── nextjs/    # @code-map/nextjs  (Next.js integration)
        └── python/    # code-map          (PyPI, FastAPI)
```

## License

[MIT](LICENSE) © code-map contributors
