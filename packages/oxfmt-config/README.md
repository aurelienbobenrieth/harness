# @aurelienbbn/oxfmt-config

**One oxfmt config for every JS/TS repo: 120 columns, double quotes, trailing commas, multiline JSDoc, sorted `package.json`.**

```sh
pnpm add -D @aurelienbbn/oxfmt-config oxfmt   # oxfmt >=0.67.0 <0.69.0 · Node ^22.19.0 || ^24.11.0
```

```ts
// oxfmt.config.ts
import { defineOxfmtConfig } from "@aurelienbbn/oxfmt-config";
import { defineConfig } from "oxfmt";

export default defineConfig(defineOxfmtConfig({ ignorePatterns: ["dist/**"] }));
```

Plain `OxfmtConfig`: works with oxfmt directly or as Vite+'s `fmt` config, no Vite+ dependency.

## Exports

| Export                                    | What                                   |
| ----------------------------------------- | -------------------------------------- |
| `defaultOxfmtConfig`                      | the baseline object                    |
| `defineOxfmtConfig(overrides?, options?)` | baseline + your overrides, fresh clone |
| `OxfmtConfig`                             | type, re-exported from `oxfmt`         |

<details>
<summary>Baseline values</summary>

| Setting                     | Value                                       |
| --------------------------- | ------------------------------------------- |
| `printWidth`                | `120`                                       |
| `tabWidth`                  | `2`                                         |
| `semi`                      | `true`                                      |
| `singleQuote`               | `false`                                     |
| `trailingComma`             | `"all"`                                     |
| `arrowParens`               | `"always"`                                  |
| `jsdoc.commentLineStrategy` | `"multiline"`                               |
| `sortPackageJson`           | `true`                                      |
| `ignorePatterns`            | `.agents/**`, `**/*.wasm`, `pnpm-lock.yaml` |
| `overrides`                 | `[]`                                        |

</details>

## Lists merge, everything else replaces

```text
defineOxfmtConfig(o)                         ignorePatterns, overrides  →  baseline + yours, deduplicated
defineOxfmtConfig(o, { replaceLists: true }) ignorePatterns, overrides  →  yours only (drops default ignores)
any other top-level key                                                  →  yours wins
```

**Result is a `structuredClone`:** mutating it never touches `defaultOxfmtConfig`.

[Compatibility matrix](../../docs/compatibility.md): packed config vs baseline and current oxfmt, complete dependency-declaration checks, clean and badly formatted inputs.
