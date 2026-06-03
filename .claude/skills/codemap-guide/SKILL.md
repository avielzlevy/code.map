---
name: codemap-guide
description: Author a code-map walkthrough guide from THIS conversation's work, then open it in code-map. Use when the user wants to capture, explain, hand off, or present what was just built/changed — "make a guide", "walk me through what we did", "create a code-map guide for this".
---

# code-map guide author

code-map *plays* guides; you author them from **this conversation**. A guide is a narrated, animated walkthrough: code-map opens a takeover player that, step by step, fades in the changed function, then **speaks your narration** while the focus glides over the exact lines each sentence is about.

You write only **semantic** content — which functions changed, and a spoken script. The sidecar does the mechanical work: it resolves each function to a real node in the live graph, **snapshots the before/after from git**, maps each sentence's focus onto real diff lines, validates, and writes the guide. You never construct node ids, line numbers, or diffs by hand.

## Prerequisites

- code-map must be running for the user's project. Default sidecar: `http://localhost:4567` (call it `$BASE`). If requests fail, ask the user for the port.

## Steps

### 1. Brief the big picture (`summary` + `overview`)
Most readers arrive without context — they (often with an LLM) just changed code they didn't write, and can't yet *explain* it because they never understood the before-state. Two guide-level fields orient them on the **first screen**, before any function:

- `summary` — **one short sentence**, the TL;DR of the whole change (e.g. "Adds an abort endpoint that signals a running deployment to stop"). Shown as a glanceable subtitle. Keep it to a single sentence — it's a summary, not a report.
- `overview` — the narrated briefing:
  - `before` — 1–3 short sentences on how the affected area worked *before* this change. This is the missing context.
  - `change` — 1–3 short sentences on what the change does and why.
- `closing` — a TED-style **closing recap**: 1–2 sentences that wrap the whole walkthrough up ("So now X flows A → B → C, validated end to end"). Shown and narrated as the final screen. Keep it short and conclusive.

Overview and closing sentences are narrated, so keep them tight. All are optional but strongly recommended — they're the orientation that makes the rest land and stick.

**Diffing committed changes (`base`):** the before/after is captured with `git diff` against `HEAD` by default — i.e. your *uncommitted* working-tree changes. If the change you're documenting is **already committed**, edited functions will show no "before". Pass `base` (a git ref) to diff against the commit *before* your change — e.g. `"base": "abc123^"` or `"base": "main"` — so edited functions get a real before/after. Omit it when authoring against uncommitted work.

### 2. Decide the steps from the conversation
List the functions involved in the change, in the order you'd teach them (usually entry point → downstream). For each, you need:
- `methodName` — the function name (e.g. `refund`).
- `file` — enough of the path to identify it (e.g. `orders.controller.ts`). Use a longer path if the basename isn't unique; add `"className"` to disambiguate same-named methods.
- `changeType` — `"added"` or `"edited"`. (`"removed"` isn't supported — a deleted function has no live node; mention deletions inside a neighboring step's narration instead.)

### 3. Write the narration — this is the value you add
For each step, write `narration`: an **ordered array of short spoken sentences**. Each sentence is one idea, and carries a `focus`:
- `text` — what to say. Write it to be *heard* — conversational, one beat per sentence. The player shows it as a chat bubble above the code and (soon) speaks it aloud.
- `focus` — an **exact substring copied from a changed line** to spotlight while that sentence plays (e.g. `"assertRefundable"` or `"order.refundedAmount = amount"`). The server finds the diff line(s) containing it and highlights them, then anchors the bubble there.

- `focusSide` — optional, `"before"` or `"after"`. Forces which diff pane the focus highlights. Default searches the after pane first, then before.

**The rule for `focus`:**
- The before/after panes show the **whole function**, not just the changed lines — so you can point at *any* line of it. **Give every on-screen sentence a `focus`**, copied verbatim from a line of the function (the server matches on collapsed whitespace, so exact spacing isn't required, but copy the real tokens — don't paraphrase). A sentence about the code with no focus shows as a tail-less note with nothing highlighted, which feels disconnected — that's the #1 thing that makes a guide feel lacklustre, so avoid it.
- Walk the function: a typical step is one sentence per meaningful line/region, each with its own focus, so the highlight moves as the narration moves.
- Omit `focus` **only** when the sentence is deliberately *not* about any code on screen — context about a caller/callee in a file this guide doesn't show. These render as a tail-less "context" note. Use this rarely.

**For `"edited"` steps, narrate the before AND the after.** The reader sees both panes — explain both. Open with what the function did *before* this change, pointing at the prior code with `"focusSide": "before"` (the focus snippet must be a line present in the before pane), then walk the new/changed lines on the after side. Understanding a change means understanding what it replaced, not just what was added.

Guidance:
- Keep `focus` distinctive enough to match one place (a method call, an assignment, a decorator).
- A typical edited step reads: *"Before, it just did X"* (before pane) → *"now it also does Y"* (after pane) → *"and Z"* (after pane).
- 2–5 sentences per step is the sweet spot.

### 4. POST it to the sidecar
```bash
curl -s -X POST "$BASE/api/flow-map/guide" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "refund-flow",
    "title": "Refund flow",
    "summary": "Adds a refund endpoint that validates the order and records the amount before refunding.",
    "closing": "So a refund now flows controller to service to guard — validated and logged end to end, no more silent status flips.",
    "overview": {
      "before": [
        "Refunds were a one-liner — the service just flipped an order'\''s status to refunded.",
        "Nothing validated the refund or recorded a money trail."
      ],
      "change": [
        "Adds a refund endpoint that loads the order and delegates to the service.",
        "The service now guards the operation and writes a ledger entry."
      ]
    },
    "steps": [
      { "methodName": "refund", "file": "orders.controller.ts", "changeType": "added",
        "narration": [
          { "text": "We start at the new refund endpoint on the orders controller.", "focus": "@Post(':id/refund')" },
          { "text": "It loads the order, then hands the real work to the service.", "focus": "this.orders.refund" }
        ] },
      { "methodName": "refund", "file": "orders.service.ts", "changeType": "edited",
        "narration": [
          { "text": "Before, refunding was a one-liner: it just flipped the status and saved.", "focus": "order.status = 'refunded'", "focusSide": "before" },
          { "text": "Now it first asserts the order can actually be refunded.", "focus": "assertRefundable" },
          { "text": "And it records the amount, so partial refunds are tracked.", "focus": "order.refundedAmount = amount" }
        ] }
    ]
  }'
```
Pick a short kebab-case `slug` (the feature name).

### 5. Check the response — this is the validation chain
The response is `{ status, data: { url, resolved, total, unresolved } }`:
- **`resolved === total`, `unresolved: []`** → success. The guide is written, with the diff and focus already snapshotted.
- **`unresolved` has entries** → each tells you why a step didn't match:
  - `"missing methodName, file, or narration"` → the step is incomplete; `narration` must be a non-empty array.
  - `"ambiguous …"` with `candidates: [...]` → re-send that step with a more specific `file` (or add `"className"`).
  - `"no matching function in the live graph"` → the function isn't parsed into the graph (e.g. it's frontend, or a file type code-map doesn't scan). Drop it or fold it into another step's narration.
  - Fix and POST again (same slug overwrites).
- **HTTP 422 / `resolved: 0`** → nothing matched; read the reasons and retry.

> Focus snippets that don't match a diff line aren't an error — that sentence simply highlights the whole function. If a focus isn't landing where you expect, pick a more exact snippet from the changed line.

### 6. Hand over the URL
On success, give the user `$BASE` + the returned `url` (e.g. `http://localhost:4567/app?guide=refund-flow`) and offer to open it (macOS: `open "<url>"`). It loads the guide and starts the narrated playback — each step fades in the function, then the focus walks the change as the narration plays.

To produce a **shareable mp4** of the walkthrough (for a PR, Slack, etc.), use the **codemap-guide-video** skill with the same slug.

### 7. (Optional) Put it on the PR
If this change has an open PR, close the loop: check whether the PR description already has a walkthrough, and if not, render the video and attach it. Hand this off to the **codemap-guide-video** skill, which has the exact steps (it finds the PR with `gh`, skips if a video is already there via the `<!-- codemap-video -->` marker, renders the mp4, and appends it to the description). Skip silently if there's no PR or `gh` isn't set up.

## Notes
- You only ever send **semantic** content (guide-level `summary` + `closing` + `overview` + optional `base`, plus per step `methodName` + `file` + `changeType` + `narration`). The server owns id resolution, the git before/after snapshot, focus-to-line mapping, validation, and file-writing. Don't build node ids, line numbers, or `.codemap/guides/*.json` yourself.
- The `overview` is guide-level (one per guide) and needs no graph resolution. Omit it and the guide opens straight on the first function.
- Narration is **spoken** during playback. If the sidecar has `OPENAI_API_KEY` set, the server pre-renders each sentence to audio at author time (cached, portable); otherwise the player uses the browser's local voice. Either way, write narration to be *heard*.
- The diff is captured from `git diff HEAD` at author time, so author the guide **after** making the change and **before** committing-and-moving-on if you want the working-tree diff. The written guide is portable: commit it or open the same URL on a teammate's checkout.
