## Design Context

### Users
Open-source community — primarily backend developers (NestJS / FastAPI / TypeScript engineers) who discover code-map on GitHub and run it locally. They arrive during debugging, onboarding, or code review with limited time and high cognitive load. They are opinionated, will compare the tool to Linear, Datadog traces, or profilers, and will share it if it impresses them. First impression is critical.

### Brand Personality
**Sharp · Confident · Precise**

A surgical developer tool that doubles as a product people want to show off and star on GitHub. Polished and opinionated like Linear or the Vercel dashboard — not a hobby project, not enterprise bloatware. No noise, just signal, but delivered with enough craft that it feels special.

### Emotional Goal
**Delight — "This is cool, I want to share this"**

When a developer first opens code-map, it should feel like discovering a cheat code. The UI reveals complexity as readable structure. Every interaction should feel snappy and considered. The goal is to be the kind of tool developers evangelize to their team.

### Aesthetic Direction
**Raycast / Linear / Warp** — frictionless, command-palette-first, pure black canvas, translucent panels. Monospace (Geist Mono) for all code identifiers; clean sans (Geist) for prose. Spring physics everywhere — nothing snaps. White as the primary interaction language; amber for secondary/optional features.

**Reference feel:** Raycast, Linear, Warp terminal.
**Anti-references:** Cluttered dashboards (Grafana default), neon-heavy dev tools, Bootstrap-gray enterprise UIs, generic AI slop (cyan-on-dark, purple gradients, glassmorphism everywhere).

### Theme
Dark-first. Pure black (`#000`) is part of the identity. Build with semantic color tokens so light mode is possible later — never hard-code color values outside of design tokens or CSS variables.

### Accessibility
Best-effort WCAG AA. Interactive elements and primary text must meet 4.5:1 contrast. Low-opacity decorative borders and subtle background layers are acceptable below threshold. Always respect `prefers-reduced-motion`.

### Color System
One color, one meaning — never reuse a color across incompatible semantic contexts.

| Color | Semantic meaning | Where used |
|---|---|---|
| White (opacity scale) | Primary UI language: active, selected, interactive, CTA | Selected rows, primary buttons, focus rings |
| Amber `#f59e0b` | Optional / enriched feature indicator | EnhancedNode borders, intent tags, AI-enriched styling |
| Green `#22c55e` | Universal success / completion | Copy-success checkmarks |
| Blue | GET HTTP method | Method badge only |
| Green | POST HTTP method | Method badge only |
| Yellow | PUT HTTP method | Method badge only |
| Gray | All other states | Disabled, secondary, decorative |

### Design Principles

1. **Signal over decoration** — Every visual element earns its place. Glows, borders, and color are used to direct attention, not fill space. If it doesn't help the developer understand the flow, remove it.

2. **White is the interaction language** — Active states, selected rows, primary CTAs, and focus indicators use white-opacity treatments (`bg-white/6`, `shadow-[inset_2px_0_0_0_rgba(255,255,255,0.35)]`, `bg-white text-black`). Color is reserved for semantic data, not chrome.

3. **One color, one meaning** — Each color token has exactly one semantic purpose (see Color System above). Never repurpose a color across unrelated UI contexts. If a new use case needs emphasis, use white-opacity or add a new token.

4. **Motion is physics, not timing** — All transitions use spring curves (damping 25–28, stiffness 220–300). Duration-based easing is a last resort. The UI should feel like it has weight. Idle/looping animations are forbidden — motion only in response to user events.

5. **Progressive disclosure, not progressive complexity** — The canvas shows the top-level flow first. Depth is always one deliberate action away (click to inspect, double-click to drill). The UI gets out of the way of the graph.
