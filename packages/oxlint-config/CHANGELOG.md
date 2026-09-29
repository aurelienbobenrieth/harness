# @aurelienbbn/oxlint-config

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
