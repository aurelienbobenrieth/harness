# @aurelienbbn/oxlint-plugin-effect

## 0.4.0

### Minor Changes

- [#38](https://github.com/aurelienbobenrieth/harness/pull/38) [`5d0da99`](https://github.com/aurelienbobenrieth/harness/commit/5d0da99bedb7eabc4f6a1b49899f38b75faedc77) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `@aurelienbbn/oxlint-plugin-effect` adds `effect/no-array-callback-reference` and `effect/no-array-for-each`: unicorn's array checks, re-implemented to skip calls on modules imported from Effect (`Option.some(value)`, `Option.filter`, `Effect.forEach`), which the unicorn rules take for arrays under namespace imports. `effect/Array` helpers, which pass the index like native methods, are still checked.

  `@aurelienbbn/oxlint-config`: `effectIdiomRules` turns `unicorn/no-array-callback-reference` and `unicorn/no-array-for-each` off in favor of those rules (without the plugin, set them back in `rules`). `withImportGraphLayer` takes `{ entrypoints }`, package entry points exempt from `oxc/no-barrel-file`, which the import graph makes count modules.

## 0.3.0

### Minor Changes

- [#30](https://github.com/aurelienbobenrieth/harness/pull/30) [`f446a1e`](https://github.com/aurelienbobenrieth/harness/commit/f446a1e049010ef3cd48346a23149c6a55b353f8) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Add `tagged-error-name`, which reports a class extending `Schema.TaggedError`, `Schema.TaggedErrorClass` or `Data.TaggedError` whose name lacks the error suffix (option `suffix`, default `"Error"`) or whose literal `_tag` differs from the class name. Report only: a rename crosses files.

## 0.2.0

### Minor Changes

- [#18](https://github.com/aurelienbobenrieth/harness/pull/18) [`c0e24ff`](https://github.com/aurelienbobenrieth/harness/commit/c0e24ff1b3b1a5b4dcd81056ff37e4ba6eaf68c8) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Add `padding-after-dependencies`, which requires a blank line between the leading service dependencies of an Effect generator body and the logic below them and inserts it with an autofix.

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Effect body rules now also recognize generators passed to named `effect/Effect` imports (`gen`, `fn`, `fnUntraced`, `fnUntracedEager`, aliased or not) and named generators passed by reference (`function* program() {}; Effect.gen(program)`).

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 32 oxlint rules for Effect code: runtime boundaries, failure channels, concurrency, services, Schema. Only what `@effect/tsgo` doesn't own.
