---
name: codemap-sharpen
description: Takes a vague task prompt and sharpens it into a laser-focused, context-rich prompt using the live code-map graph — so the receiving LLM skips exploration entirely. Use when a user has a rough idea of what they want to build or fix but the prompt lacks specificity. Triggers like "sharpen this", "make this prompt better", "I want to add X", "help me prompt for Y".
---

# codemap-sharpen

You take a developer's rough intent and turn it into a **precise, graph-grounded prompt** a receiving LLM can execute without any file exploration. The live code-map graph is your map — it tells you which nodes exist, how they connect, and where the dangerous shared paths are. You use that signal to ask sharp clarifying questions and then emit a structured prompt block the developer can paste anywhere.

## Prerequisites

- code-map must be running. Default sidecar: `http://localhost:4567` (call it `$BASE`).
- Check immediately:
  ```bash
  curl -s "$BASE/api/flow-map/graph" | head -c 100
  ```
  If the request fails, **stop**. Tell the user: "code-map isn't running — start it first (`npm run start` in the backend), then re-run `/codemap-sharpen`." Do not proceed without the graph.

## Steps

### 1. Capture the user's rough intent

Ask for (or read from the invocation args) the user's vague task. Example: "add rate limiting to auth", "fix the order creation flow", "refactor payment processing".

### 2. Pull the live graph

```bash
curl -s "$BASE/api/flow-map/graph"   # { status, data: { nodes, edges } }
curl -s "$BASE/api/flow-map/paths"   # execution paths (entry points → downstream)
```

Each node carries: `id`, `methodName`, `type`, `filePath`, `lineNumber`, `httpMethod?`, `routePath?`, `controllerPrefix?`, `docstring?`, `customTag?`, `aiSummary?`. **`rawBody` is stripped** — don't try to read source from this endpoint.

### 3. Identify candidate nodes (LLM judgment)

Pass the full node list (names + paths only — no rawBody) to yourself and reason: *which nodes are plausibly relevant to the user's intent?* Consider:
- `methodName`, `routePath`, `controllerPrefix` matching the prompt's domain keywords
- `type: 'controller'` nodes as likely entry points
- Nodes appearing in `/paths` that touch the relevant domain

Group candidates into **clusters** (e.g. "auth entry points", "auth service layer", "shared token utilities"). This is the map you'll use for questions and output.

### 4. Infer constraints from the graph

Before asking anything, derive constraints automatically:
- **High fan-in nodes** (many edges where `to === node.id`) — flag as "shared, touch carefully"
- **Nodes on multiple execution paths** — flag as "cross-cutting concern"
- **Existing patterns** — if a similar feature already exists (e.g. `ThrottlerGuard` on another controller), surface it as the reference implementation

These pre-populate the Constraints section of the output. The user can add more during clarification.

### 5. Iterative clarification — confidence-checked, cap 3 rounds

**After each round**, re-evaluate on three axes:
- **Scope** — do you know exactly which nodes to touch (and which to leave alone)?
- **Task verb** — do you know precisely what change to make (add/remove/replace/configure)?
- **Constraints** — are there any high-risk shared nodes whose role in this change is unclear?

State your current confidence after each round, e.g.:
> *Confident on: entry points (login, refresh). Still unclear: should rate limiting apply to the token validation middleware too, or only the public endpoints?*

End each clarification turn with: **"Ready to generate the prompt, or should we go deeper?"** — the user can cut the loop short at any point.

**Question rules:**
- Ask ≤ 3 questions per round, each grounded in a real node or path from the graph
- Never ask generic questions ("what's your use case?") — every question names a specific node or fork
- If scope, verb, and constraints are all clear after the graph analysis (e.g. only one candidate cluster, unambiguous task verb), **skip clarification entirely** and go straight to output

**Hard cap: 3 rounds.** After round 3, emit the prompt regardless. If anything remains uncertain, flag it explicitly in the Constraints section.

### 6. Emit the enriched prompt

Output a single fenced block the user can copy:

~~~
## Task
<refined 1-2 sentence task description>

## Entry Points
<list of methodName — filePath:lineNumber for each relevant entry point>

## Call Chain
<key execution path relevant to this task, e.g. login → validateCredentials → findByEmail>

## Relevant Nodes
<list of all nodes the implementer should be aware of, with filePath:lineNumber>

## Constraints
- <graph-inferred constraint, e.g. "TokenService (auth/token.service.ts:12) has 6 callers — do not change its interface">
- <user-supplied constraints from clarification>
- <existing pattern to follow, e.g. "ThrottlerGuard is already applied at OrdersController:8 — follow that pattern">

## Out of Scope
<nodes/areas explicitly excluded based on clarification>
~~~

Then say: *"Paste this into any agent. It has everything needed to execute without exploration."*

## Notes

- Never read full source files. Node metadata from the graph is sufficient to build the prompt. Source reading is not part of this skill.
- The output prompt is the deliverable — not a plan, not a summary. It must be self-contained and pasteable.
- If the graph has very few nodes (<10), mention it: the project may not be fully parsed yet, and the enriched prompt may be incomplete.
- Frontend code won't appear in the graph. If the task touches frontend, note that in the Out of Scope section and tell the user those files need to be added manually.
