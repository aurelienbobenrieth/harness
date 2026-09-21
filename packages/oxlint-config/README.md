# @aurelienbbn/oxlint-config

Strict reusable oxlint config for Vite+ projects.

## Presets

- `strictOxlintConfig`: baseline strict Vite+ `lint` config. Bans `@ts-ignore` and requires a description on `@ts-expect-error` via `typescript/ban-ts-comment`.
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

## Plugins

`plugins` replaces the oxlint default set instead of extending it, so the preset lists every default plugin itself: `eslint`, `typescript`, `unicorn` and `oxc`, plus `node` and `promise`. The `vitest` plugin is enabled through an `overrides` entry for `testFileGlobs` (`**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`) only, because rules such as `vitest/require-hook` report ordinary top-level calls in source files. Projects with another test layout add their own `overrides` entry with `plugins: ["vitest"]`.

Three `oxc` restriction rules are off because they ban modern syntax rather than defects: `oxc/no-async-await`, `oxc/no-optional-chaining`, `oxc/no-rest-spread-properties`.

## Resolved conflicts

With every category at `error`, some rules demand opposite edits of the same code and some report the same defect twice. The preset settles each case once so consumers do not rediscover it.

| Off                                                       | Kept                                                 | Reason                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint/no-ternary`                                       | `unicorn/prefer-ternary`, `eslint/no-nested-ternary` | Expression style is what a no-`let` codebase needs; nesting stays banned.                                                                                  |
| `node/no-top-level-await`                                 | `unicorn/prefer-top-level-await`                     | Application entry points await at the top level. Libraries re-enable the node rule.                                                                        |
| `vitest/no-importing-vitest-globals`                      | `vitest/prefer-importing-vitest-globals`             | Explicit imports keep test APIs visible to import-keyed rules.                                                                                             |
| `vitest/prefer-to-be-truthy`, `vitest/prefer-to-be-falsy` | `vitest/prefer-strict-boolean-matchers`              | `toBe(true)` is the stricter assertion.                                                                                                                    |
| `eslint/no-undefined`                                     | `unicorn/no-null`, `unicorn/no-useless-undefined`    | Banning both `null` and `undefined` leaves no way to express absence.                                                                                      |
| `eslint/no-warning-comments`                              | none                                                 | It has no option that accepts the tracked `TODO(#123):` form. `core/no-dead-comments` from `@aurelienbbn/oxlint-plugin-core` reports untracked TODOs only. |
| `eslint/default-case`                                     | `typescript/switch-exhaustiveness-check`             | A `default` on a union switch hides newly added members. See below.                                                                                        |
| `eslint/require-await`                                    | `typescript/require-await`                           | Typed extension rule; the pair reports twice.                                                                                                              |
| `eslint/no-implied-eval`                                  | `typescript/no-implied-eval`                         | Typed extension rule.                                                                                                                                      |
| `eslint/prefer-promise-reject-errors`                     | `typescript/prefer-promise-reject-errors`            | Typed extension rule.                                                                                                                                      |
| `eslint/no-throw-literal`                                 | `typescript/only-throw-error`                        | Typed extension rule.                                                                                                                                      |
| `unicorn/prefer-includes`                                 | `typescript/prefer-includes`                         | Typed duplicate.                                                                                                                                           |
| `unicorn/prefer-string-starts-ends-with`                  | `typescript/prefer-string-starts-ends-with`          | Typed duplicate.                                                                                                                                           |
| `unicorn/prefer-array-find`                               | `typescript/prefer-find`                             | Typed duplicate.                                                                                                                                           |

The typed side wins only because the preset sets `typeAware: true`. A project that turns type-aware linting off must re-enable the untyped rules.

## Type-aware additions

- `typescript/no-unnecessary-condition` is enabled by name while the nursery category stays off. It reports optional chains, nullish fallbacks and comparisons that the types prove useless. It needs `strictNullChecks`, and `noUncheckedIndexedAccess` to stay quiet on indexed access.
- `typescript/switch-exhaustiveness-check` runs with `allowDefaultCaseForExhaustiveSwitch: false` and `requireDefaultForNonUnion: true`: a union switch lists every member without a `default`, any other switch needs one.
- `nurseryCandidateRules` holds four more low-noise nursery rules that are not in the preset: `typescript/prefer-optional-chain`, `eslint/no-useless-assignment`, `eslint/no-unreachable-loop`, `promise/no-return-in-finally`. Spread it into `rules` to trial them.

## TanStack Query layer

`withTanstackQueryLayer(config, options)` is opt-in. It appends `@tanstack/eslint-plugin-query` to `jsPlugins` and sets `tanstackQueryRules` to `error`: `exhaustive-deps`, `infinite-query-property-order`, `mutation-property-order`, `no-rest-destructuring`, `no-unstable-deps`, `prefer-query-options`, `stable-query-client`, all under the `@tanstack/query/` prefix. Rules already set on `config` win over the layer.

This package does not depend on the plugin. Install it in the consuming project:

```sh
pnpm add -D @tanstack/eslint-plugin-query
```

```ts
import { defineStrictOxlintConfig, withTanstackQueryLayer } from "@aurelienbbn/oxlint-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: withTanstackQueryLayer(defineStrictOxlintConfig({ ignorePatterns: ["dist/**"] })),
});
```

`@tanstack/query/no-void-query-fn` is left out: it needs the TypeScript checker, which oxlint does not expose to JS plugins, so it reports nothing there. oxlint JS plugins are alpha.

The wiring is not verified coverage. No repository fixture installs the official plugin. A one-off run with `@tanstack/eslint-plugin-query` 5.103.1 under oxlint 1.82.0 saw five of the seven rules report; `no-unstable-deps` and `infinite-query-property-order` were not exercised, and whether `no-rest-destructuring` needs type information under oxlint is unconfirmed. Re-check after upgrading either package.

`options.companionPlugins` is the extension point for plugins that cover what the official one does not, such as `@aurelienbbn/oxlint-plugin-tanstack-query`. Each entry is `{ specifier, rules }`; the specifier is appended to `jsPlugins` after the official plugin and the rules are merged after the official rules.

## Test-file rules pinned by name

The `testFileGlobs` override sets three `vitest` rules explicitly, so an upstream category move cannot drop them silently.

- `vitest/require-to-throw-message` owns the bare `expect(fn).toThrow()` and `rejects.toThrow()` case. `core/no-weak-test-assertions` from `@aurelienbbn/oxlint-plugin-core` deliberately does not report it a second time.
- `vitest/prefer-called-with` reports a bare `toHaveBeenCalled()`. It does not create interaction assertions; it makes the existing ones exact, which is what a test needs when the call is the contract. Whether an interaction should be asserted at all is a review question for agentlint `core/test-behavior-coverage`, and the lazy way out, `toHaveBeenCalledWith(expect.anything())`, is reported by `core/no-weak-test-assertions`.
- `vitest/valid-title` runs with `mustNotMatch: vagueTestTitlePattern`. It reports titles that are only `works` / `should work` (any case) and titles containing the words `correctly`, `properly` or `as expected`. `rejects improperly signed tokens` and `works offline` pass.

`vagueTestTitlePattern` is one string on purpose. Probed with oxlint 1.82.0 in a temp directory: `mustNotMatch` fires as a string, as `{ it: "<regex>" }` and as a `[regex, message]` tuple, but it is ignored entirely as soon as `disallowedWords` is non-empty, and patterns written with `\b` or `\W` never match. The filler words therefore live in the same pattern with `[^a-z]` word edges. A project that overrides the rule keeps to a single `mustNotMatch` and leaves `disallowedWords` unset. `src/index.test.ts` runs the installed oxlint against these cases.

## Layer direction recipe

`layerDirectionOverride({ files, forbidden, message })` returns an `overrides` entry that forbids a declared layer from importing the listed modules through `eslint/no-restricted-imports` `patterns`. There is no default layer map: a project that declares no layers gets no rule.

```ts
import { defineStrictOxlintConfig, layerDirectionOverride } from "@aurelienbbn/oxlint-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: defineStrictOxlintConfig({
    overrides: [
      layerDirectionOverride({
        files: ["**/domain/**"],
        forbidden: ["**/infra/**", "**/http/**", "express", "@prisma/client"],
        message:
          "Domain code never imports infrastructure. Pass the data in, depend on a port the domain owns and let infrastructure implement it, or move this file to the layer it belongs to.",
      }),
    ],
  }),
});
```

`forbidden` takes gitignore-style globs for paths and bare names for packages; both the relative import and the package import are reported. `message` carries the fix direction, because the rule cannot know which of the three moves is right. oxlint replaces rule options instead of merging them: when two `overrides` entries match a file the later `eslint/no-restricted-imports` wins, and either one replaces a root-level `eslint/no-restricted-imports`. Give each layer glob a single entry that lists everything the layer must not reach.

## Import graph layer

`withImportGraphLayer(config)` is opt-in. It appends the `import` plugin and spreads `importGraphRules`, which turns on exactly two rules: `import/no-cycle` and `import/no-self-import`. Cycles arrive through convenience imports between sibling modules and surface later as `undefined` at module initialization and as modules that cannot be tested alone. Rules already set on `config` win over the layer.

```ts
import { defineStrictOxlintConfig, withImportGraphLayer } from "@aurelienbbn/oxlint-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: withImportGraphLayer(defineStrictOxlintConfig({ ignorePatterns: ["dist/**"] })),
});
```

The plugin cannot simply be added to `plugins`: the preset sets whole categories to `error`, so loading it would switch on every `import/*` rule, including pairs that contradict each other (`import/no-default-export` and `import/prefer-default-export`, `import/no-named-export`, `import/group-exports`). `importGraphRules` therefore pins all 33 `import/*` rules of oxlint 1.82.0: two at `error`, 31 at `off`. A project that wants another one sets it in `rules`.

`import/no-cycle` ignores cycles made only of `import type` by default (`ignoreTypes`); they vanish at runtime. It resolves files across the project, which makes it the most expensive rule of the plugin; that cost is why the layer is opt-in. Path aliases resolve only when oxlint finds the tsconfig that declares them.

Upgrade step: a rule that a newer oxlint adds to the `import` plugin is not in `importGraphRules`, so its category would enable it. After every oxlint upgrade run `pnpm exec oxlint --rules` (or `--rules -f json`), compare the `import` rows with `importGraphRules`, and pin each new rule to `off`. In this repository `src/index.test.ts` makes that comparison against the installed oxlint and fails until the list matches; consumers pinned to another oxlint version do the check by hand.

## Contract boundaries and migration

Defaults remain opinionated for this project's Node/TypeScript stack. Browser projects should explicitly override `env.node` and enable their browser environment. The nursery category is off pending deliberate upgrade review, apart from the rule named under type-aware additions; broad stable categories remain enabled. Blanket Jest-namespace assertion disables were removed. `defineStrictOxlintConfig(overrides, { replaceLists: true })` replaces supplied lists, including plugins; normal calls merge them. Returned nested rule options are independent clones.

Public types come from `vite-plus/lint`, keeping build-tool declaration dependencies outside the lint configuration contract. The [compatibility matrix](../../docs/compatibility.md) records supported peers and tests the packed config with both baseline and current compatible runners, including type-aware linting.
