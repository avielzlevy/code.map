---
name: codemap-x
description: Find the important, under-documented functions in a code-map project and enrich them — add JSDoc/docstrings and @Dot intent labels — using the live code-map graph instead of reading source. Use when the user wants to improve documentation coverage, fill doc gaps, label key flows, or "make the map read better". Triggers like "document the important stuff", "enrich the map", "where are we missing docs", "add intent labels".
---

# code-map enrich (codemap-x)

You improve a project's documentation *where it matters most*, using the **live code-map graph as your map** — not by reading the whole codebase. The graph already tells you, for every function, whether it has a docstring (`docstring`) and an intent label (`customTag`, set by `@Dot` / `@flow_step`). So you can find the important functions that lack docs **cheaply**, then read *only* those functions to write good documentation.

The deliverable is edits: real JSDoc/docstrings and `@Dot` intent labels on the functions that carry the most signal. You **propose every edit and wait for approval** before writing.

## Core principle — work from cheap, dense context

Do **not** read full source files to decide *what* to document. Use cheap, high-density sources first:
- `CLAUDE.md` / `AGENTS.md` (root and nested) — project rules, domains, vocabulary.
- Your memory (`MEMORY.md` and linked notes) — known goals, areas, prior decisions.
- `ls -a -1` / a shallow file tree — structure and naming, no contents.
- **The code-map graph and paths endpoints** — the authoritative map of functions, their kinds, call relationships, and existing doc/label coverage.

Only once targets are chosen do you read source — and then *only the targeted function*, scoped by its `lineNumber`, never the whole file.

## Prerequisites

- code-map must be running for the user's project. Default sidecar: `http://localhost:4567` (call it `$BASE`). If requests fail, ask the user for the port.

## Steps

### 1. Gather cheap context
Read `CLAUDE.md` / `AGENTS.md`, relevant memories, and run `ls -a -1` for orientation. This is enough to understand the project's domains and vocabulary without opening source.

### 2. Pull the live graph
```bash
curl -s "$BASE/api/flow-map/graph"   # { status, data: { nodes, edges, generatedAt } }
curl -s "$BASE/api/flow-map/paths"   # execution paths (entry points → downstream)
```
Each node carries: `id`, `methodName`, `type` (`controller|service|utility|unknown`), `filePath`, `lineNumber`, `httpMethod?`, `routePath?`, `controllerPrefix?`, `docstring?`, `customTag?`, `aiSummary?`. **`rawBody` is intentionally stripped** — you cannot read source from this endpoint, and you don't need to yet. Edges are `{ from, to, callOrder }`.

A function is **under-documented** when it lacks *both* `docstring` and `customTag`. (Has one but not the other → low priority; mention it but don't lead with it.)

### 3. Ask which areas to focus on — and wait
You can't document everything well, and the user knows what matters right now. Derive concrete area options from the graph (group by `controllerPrefix`, top-level directory in `filePath`, or `type`) and ask which to focus on. Present a few real options drawn from *their* graph, e.g. "orders (`orders.*`)", "auth", "the FastAPI routers under `app/api`". Wait for the answer — don't proceed on a guess.

### 4. Rank importance within the chosen areas
For the chosen areas, score under-documented nodes by graph-derived importance — no source reading required:
- **Entry points** — has `httpMethod`/`routePath`, or `type: 'controller'`. Highest signal: it's the public surface.
- **Fan-in** — number of edges where `to === node.id` (how many callers depend on it). High fan-in = shared/critical.
- **On an execution path** — appears in `/paths`. It's part of a real request flow, not dead/utility code.
- **Kind** — `service` > `utility` > `unknown`, all else equal.

Skip trivial nodes (no callers, not on any path, not an entry point) unless the user asked for exhaustive coverage — documenting noise dilutes the map.

### 5. Present the ranked shortlist; let the user trim
For each chosen area, show the ranked under-documented nodes as a short table: `methodName`, `filePath:lineNumber`, why it ranked (e.g. "POST entry point, 4 callers"), and what's missing (docstring / `@Dot` / both). Ask the user to trim or confirm the set before you touch any code.

### 6. Read ONLY the confirmed targets, then propose
For each confirmed target, read *just that function* — use `Read` with `offset`/`limit` around its `lineNumber`, not the whole file. Draft, for each:
- **Doc comment** — JSDoc (TS) or a docstring (Python). Explain *what it does and why it exists*, the real params/return, and any non-obvious behavior you can see in the body. Don't restate the name; don't invent behavior you can't see.
- **`@Dot` intent label** — a short business-intent phrase (≤ ~60 chars) that will override the raw name in the map. Add it for entry points and key service methods especially. This is what makes the map *read* like a story.

**Propose all drafts to the user and wait for approval.** Show the exact comment text and the `@Dot` line per target. Don't edit yet.

### 7. Apply approved edits — the map updates itself
On approval, make the edits. Match the project's existing language and import conventions:

| Stack | Doc comment | Intent label | Import |
|---|---|---|---|
| NestJS / TS | JSDoc `/** … */` above the method | `@Dot('Validate credentials and issue token')` above the method (below other decorators) | `import { Dot } from '@code-map/nestjs';` |
| FastAPI / Python | `"""docstring"""` as the first statement in the function | `@flow_step("Validate credentials and issue token")` above the function | `from code_map import flow_step` |

Add the import only if it isn't already present in the file. Saving triggers code-map's file watcher, which **rebuilds the graph automatically** — no rebuild call needed.

### 8. Verify and report
Re-pull `$BASE/api/flow-map/graph` and confirm the targeted nodes now carry `docstring` and/or `customTag`. Report what was enriched (and anything that didn't pick up — usually a save that hasn't been scanned yet, or a function code-map doesn't parse). Offer to open `$BASE/app` to see the relabeled map.

## Notes
- **Never read whole files to triage.** The graph's `docstring`/`customTag` fields are the gap map; the importance signals come from `edges`, `paths`, and node `type`/`httpMethod`. Source reading is reserved for *writing* a doc on a confirmed target.
- `customTag` in the graph is exactly the `@Dot` / `@flow_step` description — that's how you tell, cheaply, what's already labeled.
- Frontend functions and file types code-map doesn't scan won't appear in the graph; you can't enrich the map for those. Say so rather than guessing.
- Quality over coverage. A few precise docstrings + intent labels on the real entry points beat blanketing every utility. Match the project's voice from `CLAUDE.md`.
