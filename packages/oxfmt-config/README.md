# @aurelienbbn/oxfmt-config

Reusable oxfmt config for Vite+ projects.

## Presets

- `defaultOxfmtConfig`: baseline Vite+ `fmt` config.
- `defineOxfmtConfig(overrides)`: merge helper for project-specific overrides.

```ts
import { defineOxfmtConfig } from "@aurelienbbn/oxfmt-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: defineOxfmtConfig({
    ignorePatterns: ["dist/**"],
  }),
});
```

## Contract boundaries and migration

`defineOxfmtConfig(overrides, { replaceLists: true })` replaces explicitly supplied lists, allowing default ignores to be removed. The usual one-argument call still merges/deduplicates lists. Returned nested state is cloned and cannot mutate exported defaults.

Public types come from `vite-plus/fmt`, keeping build-tool declaration dependencies outside the formatter configuration contract. The [compatibility matrix](../../docs/compatibility.md) records supported peers and tests the packed config with complete dependency declaration checking and clean/incorrectly formatted inputs.
