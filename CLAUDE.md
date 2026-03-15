## Design Context

### Users
Developers (primarily NestJS / FastAPI engineers) who need to understand API execution paths quickly — during debugging, onboarding, or code review. They are power users who open code-map when something is unclear or broken. They have limited time and high cognitive load when they arrive.

### Brand Personality
**Precise · Calm · Powerful · Sharp · Fast · Technical**

A surgical developer tool that doubles as a product people want to show off. No noise — just signal — but delivered with enough visual craft that it feels special, not utilitarian.

### Emotional Goal
**Delight — "This is cool"**

When a developer first sees code-map, it should feel like discovering a cheat code. The UI should surprise them with how *readable* complexity becomes. Every interaction should feel snappy and considered.

### Aesthetic Direction
**Raycast / Spotlight** — glassmorphic, frictionless, command-palette-first. Layers of translucency over pure black. Rare, purposeful emerald green accents that signal intelligence and depth. Monospace type for code identifiers; clean sans for prose. Spring physics everywhere — nothing should snap.

**Reference feel:** Raycast, Linear, Warp terminal.
**Anti-references:** Cluttered dashboards (Grafana default), neon-heavy dev tools, Bootstrap-gray enterprise UIs.

### Accessibility
Best-effort WCAG AA. Interactive elements and primary text must meet 4.5:1 contrast. Low-opacity decorative borders and subtle background layers are acceptable below threshold. Respect `prefers-reduced-motion` for all animations.

### Design Principles

1. **Signal over decoration** — Every visual element earns its place. Glows, borders, and color are used to direct attention, not fill space. If it doesn't help the developer understand the flow, remove it.

2. **Layers create depth, not noise** — Use glassmorphism and translucency to communicate hierarchy (canvas → panel → modal), not for aesthetics alone. Each layer should feel like it's floating above the one beneath it.

3. **Emerald means "go deeper"** — The accent color (`#10b981`) is reserved for AI-enhanced nodes, drill-down targets, and active selection states. It signals "there is more here." Never use it decoratively.

4. **Motion is physics, not timing** — All transitions use spring curves (damping 25–28, stiffness 220–300). Easing curves are a last resort. The UI should feel like it has weight.

5. **Developers read density** — Information can be packed. Tight spacing (4–8px gaps) is appropriate for data-heavy panels. Don't over-pad or spread things out to appear "clean" — trust that the user can read.
