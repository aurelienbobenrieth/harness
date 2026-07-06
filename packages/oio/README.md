# @aurelienbbn/oio

Theme OS CLI: one entry point wrapping the theme harness so agents and humans run the same commands. Effect TS, mirroring the agentlint architecture.

## Commands

- `oio registry check` — verify the human registry (markdown table) and `registry.json` agree: same ids, same statuses, minimum count.
- `oio registry sync` — write `registry.json` from the markdown registry. Markdown owns the id set and statuses; JSON keeps `surface`/`delivery`/`path` classification.
- `oio surface audit` — print the merchant-facing catalog and flag implemented entries without surface classification.
- `oio budget` — check `assets/` against size budgets.
- `oio scaffold block|snippet|section|enhancer|machine <id>` — generate files with LiquidDoc/schema/test stubs and flip the registry entry to `skeleton`.
- `oio docs build` — generate the primitive catalog and event contract docs from registry.json + LiquidDoc, plus an `llms.txt` at the project root.

## Configuration

`oio.config.ts` at the project root:

```ts
import { defineConfig } from "@aurelienbbn/oio";

export default defineConfig({
  registry: {
    markdownPath: "docs/theme-os/primitive-registry.md",
    jsonPath: "registry.json",
    minCount: 200,
  },
  budgets: [
    { pattern: "*.js", maxBytes: 32_000 },
    { pattern: "critical*.css", maxBytes: 14_000 },
  ],
  namespace: "oio",
});
```
