# @aurelienbbn/oxfmt-config

Reusable oxfmt config for JavaScript and TypeScript projects. The returned object works with Oxfmt directly and with hosts such as Vite+ that consume `OxfmtConfig`.

## Presets

- `defaultOxfmtConfig`: baseline Oxfmt config, including multiline JSDoc formatting.
- `defineOxfmtConfig(overrides)`: merge helper for project-specific overrides.

```ts
import { defineOxfmtConfig } from "@aurelienbbn/oxfmt-config";
import { defineConfig } from "oxfmt";

export default defineConfig(
  defineOxfmtConfig({
    ignorePatterns: ["dist/**"],
  }),
);
```

## Contract boundaries and migration

`defineOxfmtConfig(overrides, { replaceLists: true })` replaces explicitly supplied lists, allowing default ignores to be removed. The usual one-argument call still merges/deduplicates lists. Returned nested state is cloned and cannot mutate exported defaults.

Public types come from `oxfmt`. Vite+ re-exports the same contract, so a consumer can also pass the returned object as its `fmt` configuration without adding a Vite+ dependency here. The [compatibility matrix](../../docs/compatibility.md) records supported peers and tests the packed config with complete dependency declaration checking and clean/incorrectly formatted inputs.
