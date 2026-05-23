<p align="center">
  <img src="frontend/public/code.map-logo.png" alt="code.map" width="400" />
</p>

<h1 align="center">code.map</h1>

<p align="center">
  <em>Interactive API execution graph for Typescript and Python frameworks — see your full call chain in seconds</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@code-map/nestjs"><img src="https://img.shields.io/npm/v/@code-map/nestjs?style=flat-square&label=%40code-map%2Fnestjs&color=white" alt="npm version"></a>
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

code-map instruments your API and renders the full execution path — from route handler down to every service call — as an interactive call graph. Drop it into any framework supported, open your browser, and your codebase becomes a map.

It's a zero-configuration sidecar: add one module, get a live visualization at `localhost:4567`. No rebuild, no separate process. Optional AI summaries (powered by Claude Haiku) annotate each node with a plain-English intent label, cached after first run.

## Features

- **Instant call graphs** — Select any endpoint and the full execution path renders as a directed graph, laid out automatically with dagre
- **Drill-down navigation** — Click any node to expand one level deeper; breadcrumbs let you navigate back up
- **VS Code deep links** — Every node links directly to the exact source file and line number
- **Command palette** — `Cmd+K` to search endpoints and functions across the entire graph
- **AI intent summaries** — Optional Claude integration annotates each function with a 10-word plain-English summary, cached in `.flow-cache/` after first run
- **`@FlowStep` decorator** — Tag critical functions with a business-intent label that appears inline on the graph node
- **Zero-config sidecar** — Spawns an Express server alongside your app; no separate process or infrastructure needed
- **Spring-physics UI** — Every transition uses spring curves — nothing snaps

## Quick Start

### Install with an agent (recommended)

Paste this prompt to your coding agent (Claude Code, Cursor, etc.). It detects your framework, asks how you want AI summaries set up, installs and wires in code-map, and installs the `/codemap-guide` skill globally.

```text
Set up code-map (https://github.com/avielzlevy/code-map) in this project — a dev tool
that renders my API's execution graph at http://localhost:4567.

1. Detect my framework from the manifest:
   - NestJS  → "@nestjs/core" in package.json
   - FastAPI → "fastapi" in requirements.txt / pyproject.toml
   If it's neither, stop and tell me code-map currently supports NestJS and FastAPI.

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
   - NestJS:  npm install @code-map/nestjs
   - FastAPI: pip install code-map

4. Wire it in, GUARDED FOR DEVELOPMENT ONLY (never in production):
   - NestJS  — in app.module.ts add FlowMapperModule.forRoot({ port: 4567, ...ai }) to imports.
   - FastAPI — in the app entry: FlowMap.bind(app, config={"port": 4567, ...ai}).
   Apply my AI choice as ...ai:
       • Off    → no AI fields.
       • Local  → NestJS: enableAI: true, provider: 'ollama'
                  FastAPI: "enable_ai": True, "provider": "ollama"
       • Remote → NestJS: enableAI: true, provider: '<provider>', apiKey: process.env.<KEY>
                  FastAPI: "enable_ai": True, "provider": "<provider>", "api_key": os.environ["<KEY>"]
                  and tell me which env var to set.

5. Install the code-map skill globally so I can author guides from any project:
   mkdir -p ~/.claude/skills/codemap-guide
   curl -fsSL https://raw.githubusercontent.com/avielzlevy/code-map/main/.claude/skills/codemap-guide/SKILL.md \
     -o ~/.claude/skills/codemap-guide/SKILL.md

6. Explain the skill to me: after we work through a change together I can run
   /codemap-guide — it authors a step-by-step walkthrough of what we changed (which
   functions, and why), saves it to .codemap/guides/, and opens it in code-map so I can
   replay the change on the visual graph. It's shareable — commit it or send the URL.

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
import { FlowMapperModule } from '@code-map/nestjs';

@Module({
  imports: [
    FlowMapperModule.forRoot({ port: 4567 }),
    // ...your other modules
  ],
})
export class AppModule {}
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
from code_map import FlowMap

app = FastAPI()
FlowMap.bind(app, config={"port": 4567})
```

Start your app, then open **http://localhost:4567**.

---

You'll see the code-map UI. Select an endpoint from the left panel — your full execution graph appears on the canvas.

> [!NOTE]
> code-map is a development tool. Guard the import behind `process.env.NODE_ENV !== 'production'` (NestJS) or an equivalent env check before deploying.

## Usage

### Annotating key functions with `@FlowStep`

Mark important functions with a business-intent label. It renders as an amber pill directly on the graph node.

**NestJS:**

```typescript
import { FlowStep } from '@code-map/nestjs';

@Injectable()
export class OrderService {
  @FlowStep('Validate cart and apply discounts')
  async processCheckout(cartId: string) {
    // ...
  }
}
```

**FastAPI:**

```python
from code_map import flow_step

@flow_step("Validate cart and apply discounts")
async def process_checkout(cart_id: str):
    # ...
```

### Enabling AI summaries

Pass an Anthropic API key to have Claude Haiku generate plain-English summaries for every function in the graph. Summaries are cached in `.flow-cache/` after the first run, keyed by function body hash.

**NestJS:**

```typescript
FlowMapperModule.forRoot({
  port: 4567,
  enableAI: true,
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

**FastAPI:**

```python
FlowMap.bind(app, config={
    "port": 4567,
    "enable_ai": True,
    "api_key": os.environ["ANTHROPIC_API_KEY"],
})
```

`@FlowStep`-tagged nodes are highlighted with an amber border to distinguish them from standard nodes. You can also set your API key and provider via the `SUMMARIES_API_KEY` and `SUMMARIES_PROVIDER` environment variables instead of passing them in config.

**Local, no API key (Ollama):** run summaries entirely on your machine — no key, no data leaves your laptop. Requires [Ollama](https://ollama.com) running locally.

```typescript
FlowMapperModule.forRoot({ port: 4567, enableAI: true, provider: 'ollama' })
```

Either way, summaries are cached in `.flow-cache/` and regenerated incrementally — only when a function's body changes — so it's a one-time cost per function, not per run.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4567` | Port for the sidecar server |
| `enableAI` / `enable_ai` | `boolean` | `false` | Generate AI summaries via Claude Haiku |
| `apiKey` / `api_key` | `string` | `SUMMARIES_API_KEY` env var | API key for the chosen provider (required when AI is enabled) |
| `provider` | `string` | `SUMMARIES_PROVIDER` env var | LLM provider: `anthropic`, `openai`, `google`, `openrouter` (API key required), or `ollama` (local, no key) |
| `cachePath` / `cache_path` | `string` | `.flow-cache` | Directory for cached AI summaries |
| `sourceRoot` / `source_root` | `string` | `process.cwd()` | Root directory scanned for source files |

## How It Works

code-map runs as a lightweight sidecar alongside your application:

1. **At startup** — The AST parser walks your source directory and builds a call graph by statically analyzing class declarations, method signatures, and decorators
2. **At runtime** — The sidecar serves the graph over a local HTTP server on `/api/flow-map/paths`
3. **In the browser** — The frontend fetches the graph, lays it out with dagre, and renders it with React Flow and spring-physics animations
4. **On demand** — Clicking a node fetches its detail subgraph (one level deep); VS Code links open the source file at the exact line

The maximum traced depth is 4 call levels. Excluded from analysis: `node_modules`, `dist`, `.git`, `coverage`, `__tests__`.

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change, then submit a PR against `main`.

The repo is a monorepo:

```
code-map/
├── frontend/          # Next.js UI
└── backend/
    └── packages/
        ├── nestjs/    # @code-map/nestjs
        └── python/    # code-map (PyPI)
```

## License

[MIT](LICENSE) © code-map contributors
