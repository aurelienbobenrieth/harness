# @aurelienbbn/oxlint-config

Strict reusable oxlint config for Vite+ projects.

## Presets

- `strictOxlintConfig`: baseline strict Vite+ `lint` config.
- `defineStrictOxlintConfig(overrides)`: merge helper for project-specific overrides.

```ts
import { defineStrictOxlintConfig } from "@aurelienbbn/oxlint-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: defineStrictOxlintConfig({
    ignorePatterns: ["dist/**"],
    rules: {
      "id-length": "off",
    },
  }),
});
```
