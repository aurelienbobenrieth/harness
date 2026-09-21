---
name: closed-design-system
description: Configure and verify project-owned Tailwind v4 theme tokens when the user requests a closed theme or design-token restriction. Use for that deliberate setup or retrofit, not for unrelated UI edits.
---

# Closed Design System

Inspect the owning stylesheet, installed Tailwind version, existing tokens, and consuming components. Establish which token namespaces the project intends to own and migrate affected uses within the requested scope.

Tailwind's top-level `@theme` block accepts `--*: initial` to reset default theme variables before declaring project tokens. This changes token-derived utilities. Static utilities such as `flex` and arbitrary values remain possible; token reset is not an exhaustive class allowlist. See [Tailwind theme variables](https://tailwindcss.com/docs/theme).

## Prove the selected contract

Use an isolated probe stylesheet that imports the real owning stylesheet. Explicitly request both allowed and forbidden candidate classes with `@source inline(...)`, so a forbidden selector's absence cannot merely mean that source discovery never requested it. Follow the installed version's [source detection syntax](https://tailwindcss.com/docs/detecting-classes-in-source-files).

Compile with the consumer's pinned local toolchain. Supply an explicit native executable and argument array to the conformance check. On Windows, use Node plus the installed CLI entrypoint instead of a package-manager shell shim. Do not download a floating CLI during validation.

Require selected project selectors to be present and selected default-token selectors to be absent in that output. A finite probe establishes those examples only. If the project requires a complete allowlist, also enforce class construction and arbitrary-value policy with an appropriate source check; a composition helper alone does not establish enforcement.

Use [the consumer wiring example](closed-design-system-probe.example.ts), adjusting the stylesheet, installed CLI path, and selector lists. Its `buildCommand` is required; core conformance deliberately has no framework-specific default builder.

Run the probe with the consumer's required checks, and inspect affected rendered UI when changing visual behavior. Report build failures or missing tooling as unevaluated behavior, never as proof that forbidden selectors were absent. Keep production source free of probe-only candidates.

```ts
/** @attribution https://tailwindcss.com/docs/theme (inspiration from official documentation; independently written guidance) */
```
