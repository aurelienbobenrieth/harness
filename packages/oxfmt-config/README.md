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
