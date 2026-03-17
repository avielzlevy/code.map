<p align="center">
  <img src="frontend/public/code.map-logo.png" alt="code.map" width="140" />
</p>

<h1 align="center">code.map</h1>

<p align="center">
  <em>Interactive API execution graph for NestJS and FastAPI — see your full call chain in seconds</em>
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

---

<p align="center">
  <img src="frontend/public/code.map-demo.gif" alt="code.map demo" width="100%" />
</p>

---

code-map instruments your API and renders the full execution path — from route handler down to every service call — as an interactive call graph. Drop it into a NestJS or FastAPI app, open your browser, and your codebase becomes a map.

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

AI-enriched nodes are highlighted with an amber border to distinguish them from standard nodes. You can also set the key via the `FLOW_MAP_API_KEY` environment variable instead of passing it in config.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4567` | Port for the sidecar server |
| `enableAI` / `enable_ai` | `boolean` | `false` | Generate AI summaries via Claude Haiku |
| `apiKey` / `api_key` | `string` | `FLOW_MAP_API_KEY` env var | Anthropic API key (required when AI is enabled) |
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
