# @aurelienbbn/oxlint-config

**Strict oxlint for TypeScript: every stable category at `error`, type-aware, warnings denied, every rule conflict settled.**

```sh
pnpm add -D @aurelienbbn/oxlint-config oxlint oxlint-tsgolint
# oxlint >=1.82.0 <2.0.0 · oxlint-tsgolint ^7.0.2001 · Node ^22.19.0 || ^24.11.0
```

```ts
// oxlint.config.ts
import { defineStrictOxlintConfig } from "@aurelienbbn/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig(
  defineStrictOxlintConfig({
    ignorePatterns: ["dist/**"],
  }),
);
```

Returns a plain `OxlintConfig`: works with oxlint directly or as Vite+'s `lint` config, no Vite+ dependency.

## 1 preset, 4 opt-ins

| Export                                                  | Adds                                                 |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `strictOxlintConfig`                                    | the preset object                                    |
| `defineStrictOxlintConfig(overrides?, options?)`        | preset + your overrides, cloned                      |
| `withTanstackQueryLayer(config?, options?)`             | 🔌 official `@tanstack/eslint-plugin-query`, 7 rules |
| `withImportGraphLayer(config?)`                         | 🔌 `import/no-cycle` + `import/no-self-import`       |
| `layerDirectionOverride({ files, forbidden, message })` | 🔌 one `overrides` entry banning cross-layer imports |
| `nurseryCandidateRules`                                 | 🔌 4 nursery rules to trial                          |

Also: `testFileGlobs`, `vagueTestTitlePattern`, `tanstackQueryRules`, `tanstackQueryPluginSpecifier`, `importGraphRules`, type `OxlintConfig`.

## What the preset sets

```text
correctness  ██████  error      style       ██████  error
pedantic     ██████  error      suspicious  ██████  error
perf         ██████  error      nursery     ░░░░░░  off (pending upgrade review)
restriction  ██████  error
```

**`vitest` never runs on source files**, only on `testFileGlobs`: `vitest/require-hook` reports ordinary top-level calls.

<details>
<summary>Plugins, options, pinned rules</summary>

| Key            | Value                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `plugins`      | `eslint`, `typescript`, `unicorn`, `oxc`, `node`, `promise`                                          |
| `options`      | `typeAware: true`, `typeCheck: true`, `denyWarnings: true`, `reportUnusedDisableDirectives: "error"` |
| `env`          | `builtin: true`, `node: true`                                                                        |
| `overrides[0]` | `vitest` plugin on `testFileGlobs` = `**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`              |

`plugins` replaces oxlint's default set, so the four defaults (`eslint`, `typescript`, `unicorn`, `oxc`) are re-listed before `node` and `promise`. Other test layout: add an `overrides` entry with `plugins: ["vitest"]`.

| Rule                                                                              | Setting                                                                         | Why                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `typescript/ban-ts-comment`                                                       | `ts-ignore` banned, `ts-expect-error` needs description                         | a suppression says why                                                          |
| `typescript/no-explicit-any`, `typescript/no-non-null-assertion`                  | `error`                                                                         | pinned by name                                                                  |
| `unicorn/filename-case`                                                           | `kebabCase`                                                                     | one naming scheme                                                               |
| `eslint/no-underscore-dangle`                                                     | allow `_tag`, `_tree`, `__dirname`                                              | tagged unions, Node globals                                                     |
| `eslint/one-var`                                                                  | `never`                                                                         | grouping makes later edits noisier                                              |
| `oxc/no-async-await`, `oxc/no-optional-chaining`, `oxc/no-rest-spread-properties` | `off`                                                                           | ban modern syntax, not defects                                                  |
| `vitest/no-standalone-expect`                                                     | `off` (test files)                                                              |                                                                                 |
| `typescript/no-unnecessary-condition`                                             | `error` by name (nursery off)                                                   | needs `strictNullChecks`; `noUncheckedIndexedAccess` keeps indexed access quiet |
| `typescript/switch-exhaustiveness-check`                                          | `allowDefaultCaseForExhaustiveSwitch: false`, `requireDefaultForNonUnion: true` | union switch: every member, no `default`; other switch: `default` required      |

`nurseryCandidateRules` (not in the preset; spread into `rules` to trial): `typescript/prefer-optional-chain`, `eslint/no-useless-assignment`, `eslint/no-unreachable-loop`, `promise/no-return-in-finally`.

</details>

## Every conflict is settled once

| ❌ Off                                                    | ✅ Kept                                              | Why                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `eslint/no-ternary`                                       | `unicorn/prefer-ternary`, `eslint/no-nested-ternary` | no-`let` code needs expressions; nesting stays banned                         |
| `node/no-top-level-await`                                 | `unicorn/prefer-top-level-await`                     | app entry points; libraries re-enable the node rule                           |
| `vitest/no-importing-vitest-globals`                      | `vitest/prefer-importing-vitest-globals`             | imports stay visible to import-keyed rules                                    |
| `vitest/prefer-to-be-truthy`, `vitest/prefer-to-be-falsy` | `vitest/prefer-strict-boolean-matchers`              | `toBe(true)` is stricter                                                      |
| `eslint/no-undefined`                                     | `unicorn/no-null`, `unicorn/no-useless-undefined`    | banning both `null` and `undefined` leaves no way to express absence          |
| `eslint/no-warning-comments`                              | —                                                    | rejects tracked `TODO(#123):`; `core/no-dead-comments` reports untracked only |
| `eslint/default-case`                                     | `typescript/switch-exhaustiveness-check`             | `default` hides new union members                                             |
| `eslint/require-await`                                    | `typescript/require-await`                           | typed extension                                                               |
| `eslint/no-implied-eval`                                  | `typescript/no-implied-eval`                         | typed extension                                                               |
| `eslint/prefer-promise-reject-errors`                     | `typescript/prefer-promise-reject-errors`            | typed extension                                                               |
| `eslint/no-throw-literal`                                 | `typescript/only-throw-error`                        | typed extension                                                               |
| `unicorn/prefer-includes`                                 | `typescript/prefer-includes`                         | typed duplicate                                                               |
| `unicorn/prefer-string-starts-ends-with`                  | `typescript/prefer-string-starts-ends-with`          | typed duplicate                                                               |
| `unicorn/prefer-array-find`                               | `typescript/prefer-find`                             | typed duplicate                                                               |

> [!WARNING]
> **The typed side wins only because `typeAware: true`.** Turn it off: re-enable the untyped rules.

## Vague test titles fail

```ts
it("works", …)                            // ❌ bare "works" / "should work", any case
it("adds items correctly", …)             // ❌ correctly / properly / as expected
it("rejects improperly signed tokens", …) // ✅
```

<details>
<summary>Test-file rules pinned by name, and the oxlint 1.82.0 <code>mustNotMatch</code> probe</summary>

Pinned so an upstream category move can't drop them:

| Rule                              | Owns                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `vitest/require-to-throw-message` | bare `toThrow()` / `rejects.toThrow()` (`core/no-weak-test-assertions` skips this)          |
| `vitest/prefer-called-with`       | bare `toHaveBeenCalled()`: makes existing interaction assertions exact, doesn't create them |
| `vitest/valid-title`              | `mustNotMatch: vagueTestTitlePattern`                                                       |

Whether to assert a call at all: agentlint `core/test-behavior-coverage`. `toHaveBeenCalledWith(expect.anything())`: `core/no-weak-test-assertions`.

| `mustNotMatch` form (oxlint 1.82.0)    | Fires?           |
| -------------------------------------- | ---------------- |
| plain string                           | ✅               |
| `{ it: "<regex>" }`                    | ✅               |
| `[regex, message]` tuple               | ✅               |
| any form + non-empty `disallowedWords` | ❌ ignored       |
| pattern with `\b` or `\W`              | ❌ never matches |

So filler words share one pattern with `[^a-z]` word edges. **Overriding: keep one `mustNotMatch`, leave `disallowedWords` unset.** `src/index.test.ts` runs the installed oxlint against these cases.

</details>

## Opt-in layers

```ts
import {
  defineStrictOxlintConfig,
  layerDirectionOverride,
  withImportGraphLayer,
  withTanstackQueryLayer,
} from "@aurelienbbn/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig(
  withImportGraphLayer(
    withTanstackQueryLayer(
      defineStrictOxlintConfig({
        overrides: [
          layerDirectionOverride({
            files: ["**/domain/**"],
            forbidden: ["**/infra/**", "express"],
            message: "Domain never imports infrastructure.",
          }),
        ],
      }),
    ),
  ),
);
```

**Rules already set on `config` win over any layer.**

> [!WARNING]
> **oxlint replaces rule options, it doesn't merge them.** Two `overrides` matching one file: the later `eslint/no-restricted-imports` wins, and either replaces a root-level one. One entry per layer glob, listing everything it must not reach.

<details>
<summary>TanStack Query layer: install, probe results, companion plugins</summary>

```sh
pnpm add -D @tanstack/eslint-plugin-query   # not a dependency of this package
```

Appends the plugin to `jsPlugins`, sets `tanstackQueryRules` to `error`.

| `@tanstack/query/…`             | Reported in probe¹                                                  |
| ------------------------------- | ------------------------------------------------------------------- |
| `exhaustive-deps`               | ✅                                                                  |
| `mutation-property-order`       | ✅                                                                  |
| `no-rest-destructuring`         | ✅ (needs type info under oxlint? unconfirmed)                      |
| `prefer-query-options`          | ✅                                                                  |
| `stable-query-client`           | ✅                                                                  |
| `infinite-query-property-order` | ⚠️ not exercised                                                    |
| `no-unstable-deps`              | ⚠️ not exercised                                                    |
| `no-void-query-fn`              | ❌ left out: needs the TS checker, not exposed to oxlint JS plugins |

¹ `@tanstack/eslint-plugin-query` 5.103.1 under oxlint 1.82.0, one-off. **Wiring, not verified coverage:** no repo fixture installs the official plugin; oxlint JS plugins are alpha. Re-check after upgrading either.

`options.companionPlugins`: `{ specifier, rules }[]`. Specifier appended to `jsPlugins` after the official plugin; rules merge after the official rules.

```ts
withTanstackQueryLayer(config, {
  companionPlugins: [
    {
      specifier: "@aurelienbbn/oxlint-plugin-tanstack-query",
      rules: { "tanstack-query/no-query-cache-mutation": "error" },
    },
  ],
});
```

</details>

<details>
<summary>Layer direction: fields</summary>

One `overrides` entry using `eslint/no-restricted-imports` `patterns`. **No default layer map:** no layers, no rule.

| Field       | Takes                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `files`     | globs of the protected layer                                                                       |
| `forbidden` | gitignore-style globs for paths, bare names for packages; relative and package imports both report |
| `message`   | the fix direction: the rule can't know which of the three moves is right                           |

</details>

<details>
<summary>Import graph layer: why opt-in, upgrade checklist</summary>

Cycles creep in through convenience imports between siblings, then surface as `undefined` at module init and untestable modules.

```text
import rules in oxlint 1.82.0   33
  error  ██                      2   import/no-cycle, import/no-self-import
  off    ███████████████████████ 31  pinned off in importGraphRules
```

Adding `"import"` to `plugins` alone switches on all 33 (whole categories are enabled), including contradicting pairs: `import/no-default-export` vs `import/prefer-default-export`, `import/no-named-export`, `import/group-exports`. Want another: set it in `rules`.

| Behavior         | Detail                                                        |
| ---------------- | ------------------------------------------------------------- |
| type-only cycles | ignored (`ignoreTypes`): gone at runtime                      |
| cost             | resolves files project-wide, the plugin's most expensive rule |
| path aliases     | resolve only when oxlint finds the declaring tsconfig         |

**After every oxlint upgrade**, a new `import/*` rule missing from `importGraphRules` turns on via its category:

- [ ] `pnpm exec oxlint --rules` (or `--rules -f json`)
- [ ] compare `import` rows with `importGraphRules`
- [ ] pin each new rule `off`

Here `src/index.test.ts` fails until the list matches the installed oxlint. Consumers on another oxlint check by hand.

</details>

## Contract & migration

| Topic                   | Contract                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| target                  | Node/TypeScript. Browser: override `env.node`, enable the browser env                                                           |
| nursery                 | off pending upgrade review, except `typescript/no-unnecessary-condition`                                                        |
| Jest-namespace disables | ⚠️ removed                                                                                                                      |
| lists                   | `plugins`, `jsPlugins`, `ignorePatterns`, `overrides` merge deduplicated; `{ replaceLists: true }` replaces any list you supply |
| objects                 | `categories`, `env`, `options`, `rules`, `settings` merge key by key                                                            |
| isolation               | nested rule options are independent clones                                                                                      |
| types                   | from `oxlint`; Vite+ re-exports the same contract                                                                               |
| compatibility           | [matrix](../../docs/compatibility.md) tests the packed config on baseline and current runners, type-aware included              |
