---
name: codemap-guide
description: Author a code-map walkthrough guide from THIS conversation's work, then open it in code-map. Use when the user wants to capture, explain, hand off, or present what was just built/changed — "make a guide", "walk me through what we did", "create a code-map guide for this".
---

# code-map guide author

code-map *plays* guides; you author them from **this conversation**. You describe — in plain language — which functions were added or edited and why. The code-map sidecar does the mechanical work: it resolves each function to a real node in the live graph, validates it, and writes the guide file. You never construct node ids or write JSON by hand.

## Prerequisites

- code-map must be running for the user's project. Default sidecar: `http://localhost:4567` (call it `$BASE`). If requests fail, ask the user for the port.

## Steps

### 1. Decide the steps from the conversation
List the functions involved in the change, in the order you'd teach them (usually entry point → downstream). For each, you need:
- `methodName` — the function name (e.g. `create`).
- `file` — enough of the path to identify it (e.g. `orders.controller.ts`). Use a longer path if the basename isn't unique.
- `changeType` — `"added"` or `"edited"`. (`removed` isn't supported yet — mention deletions inside a neighboring step's explanation instead.)
- `explanation` — 1–3 sentences: what this function does now, why it changed, how it fits the whole change. This is the value you add; keep it concrete.

### 2. POST it to the sidecar
```bash
curl -s -X POST "$BASE/api/flow-map/guide" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "refund-flow",
    "title": "Refund flow",
    "steps": [
      { "methodName": "create", "file": "orders.controller.ts", "changeType": "added",
        "explanation": "New endpoint that starts the refund and hands off to OrdersService." },
      { "methodName": "create", "file": "orders.service.ts", "changeType": "edited",
        "explanation": "Now validates inventory before persisting, so refunds fail fast." }
    ]
  }'
```
Pick a short kebab-case `slug` (the feature name).

### 3. Check the response — this is the validation chain
The response is `{ status, data: { url, resolved, total, unresolved } }`:
- **`resolved === total`, `unresolved: []`** → success. The guide is written.
- **`unresolved` has entries** → each tells you why a step didn't match:
  - `"ambiguous …"` with `candidates: [...]` → re-send that step with a more specific `file` (or add `"className"`).
  - `"no matching function in the live graph"` → the function isn't parsed into the graph (e.g. it's frontend, or a file type code-map doesn't scan). Drop it or fold it into another step's explanation.
  - `"removed functions are not in the graph yet"` → describe the deletion in a neighboring step instead.
  - Fix and POST again (same slug overwrites).
- **HTTP 422 / `resolved: 0`** → nothing matched; read the reasons and retry.

### 4. Hand over the URL
On success, give the user `$BASE` + the returned `url` (e.g. `http://localhost:4567/app?guide=refund-flow`) and offer to open it (macOS: `open "<url>"`). It loads the guide and starts the walkthrough on the canvas — each step pans to the node, colors it by change type, and shows your explanation in the node.

## Notes
- You only ever send **semantic** content (`methodName` + `file` + `changeType` + `explanation`). The server owns id resolution, relativization, validation, and file-writing. Don't build node ids or write `.codemap/guides/*.json` yourself.
- To disambiguate same-named methods, pass a longer `file` path or add `"className": "OrdersService"`.
- The written guide is portable: commit it or open the same URL on a teammate's checkout.
