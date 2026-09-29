# @aurelienbbn/oxlint-config

## 0.7.0

### Minor Changes

- [#38](https://github.com/aurelienbobenrieth/harness/pull/38) [`5d0da99`](https://github.com/aurelienbobenrieth/harness/commit/5d0da99bedb7eabc4f6a1b49899f38b75faedc77) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `@aurelienbbn/oxlint-plugin-effect` adds `effect/no-array-callback-reference` and `effect/no-array-for-each`: unicorn's array checks, re-implemented to skip calls on modules imported from Effect (`Option.some(value)`, `Option.filter`, `Effect.forEach`), which the unicorn rules take for arrays under namespace imports. `effect/Array` helpers, which pass the index like native methods, are still checked.

  `@aurelienbbn/oxlint-config`: `effectIdiomRules` turns `unicorn/no-array-callback-reference` and `unicorn/no-array-for-each` off in favor of those rules (without the plugin, set them back in `rules`). `withImportGraphLayer` takes `{ entrypoints }`, package entry points exempt from `oxc/no-barrel-file`, which the import graph makes count modules.

- [#36](https://github.com/aurelienbobenrieth/harness/pull/36) [`79ae244`](https://github.com/aurelienbobenrieth/harness/commit/79ae244bf431f370c70b955d9aae6eebd57730f4) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `effectIdiomRules` (applied by `withEffectTsgoLayer`) now also settles three strict rules that misread idiomatic Effect code: `eslint/no-redeclare` and `unicorn/throw-new-error` are off (a Schema beside its same-named type, the `Schema.TaggedError<Self>()(…)` factory), and `typescript/prefer-readonly-parameter-types` treats methods as readonly, ignores inferred parameter types, and allows Effect's immutable types by name. Consumers that set these rules themselves can drop their overrides; nothing that passed before reports now.

## 0.6.0

### Minor Changes

- [#34](https://github.com/aurelienbobenrieth/harness/pull/34) [`43772cd`](https://github.com/aurelienbobenrieth/harness/commit/43772cd73c565012e120119cbd816b8a48277587) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `eslint/sort-keys` is off in the strict preset. Declaration order carries meaning that alphabetical order erases: an Effect Schema or Drizzle table lists `id` first and timestamps last, and Drizzle keeps that order as the physical column order. Code that is already sorted stays valid.

## 0.5.0

### Minor Changes

- [#32](https://github.com/aurelienbobenrieth/harness/pull/32) [`9bd7af2`](https://github.com/aurelienbobenrieth/harness/commit/9bd7af247d7ef03a1f1c3f80befe14123545a1d1) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Size rules no longer depend on formatting. `eslint/max-lines-per-function` is off, since `eslint/max-statements` already bounds a function by what it does. `eslint/max-lines` stays at 300 but skips blank and comment lines, so JSDoc and a narrower print width no longer count toward it.

## 0.4.0

### Minor Changes

- [#30](https://github.com/aurelienbobenrieth/harness/pull/30) [`f446a1e`](https://github.com/aurelienbobenrieth/harness/commit/f446a1e049010ef3cd48346a23149c6a55b353f8) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `effectIdiomRules` turns off `eslint/max-classes-per-file`: tagged errors, `Schema.Class` models and services are classes, so a domain module that keeps its schemas beside the errors it raises no longer has to split into one file per class.

## 0.3.0

### Minor Changes

- [#28](https://github.com/aurelienbobenrieth/harness/pull/28) [`cfda09e`](https://github.com/aurelienbobenrieth/harness/commit/cfda09e2903fe606ee681ae930ec384c34ab0a00) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Test files: `vitest/require-hook` allows the documented top-level `alchemyConformance`, `cloudflareConformance`, `coreConformance` and `shopifyAppConformance` calls, and `eslint/no-magic-numbers` is off so expected values and `expect.assertions(n)` stay literal. Source files keep both rules.

## 0.2.0

### Minor Changes

- [#25](https://github.com/aurelienbobenrieth/harness/pull/25) [`c812441`](https://github.com/aurelienbobenrieth/harness/commit/c812441dc93e718ff0585dddf1cd5d9229260de7) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `withEffectTsgoLayer` now applies `effectIdiomRules`: `@effect/tsgo` wins over `typescript/promise-function-async`, and `eslint/new-cap`, `eslint/func-names` and `node/no-sync` accept Effect constructors, `Effect.gen` generators and `Effect.runSync`.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. Strict oxlint for TypeScript: every stable category at `error`, type-aware, warnings denied, every rule conflict settled.
