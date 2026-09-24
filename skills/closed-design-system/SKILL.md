---
name: closed-design-system
description: Close a Tailwind v4 theme to project-owned tokens and prove it, when asked for a closed theme or token restriction. Not for unrelated UI edits.
---

# Closed Design System

- `--*: initial` in the top-level `@theme` ([docs](https://tailwindcss.com/docs/theme)), then migrate affected uses. Static utilities and arbitrary values survive: not a class allowlist.
- Probe: isolated stylesheet importing the real one, requesting allowed and forbidden classes via `@source inline(...)` ([syntax](https://tailwindcss.com/docs/detecting-classes-in-source-files)), else absence may mean undiscovered. Assert allowed present, forbidden absent.
- Compile with the pinned local CLI as executable + argument array; Windows: Node + CLI entrypoint, not a shim. Never download a floating CLI.
- Wire from [the example](closed-design-system-probe.example.ts); `buildCommand` is required: core conformance has no framework default.
- Full allowlist wanted → also enforce class construction and arbitrary values with a source check.
- Build failure or missing tooling → unevaluated, never "forbidden absent". No probe candidates in production source.

```ts
/** @attribution https://tailwindcss.com/docs/theme (inspiration from official documentation; independently written guidance) */
```
