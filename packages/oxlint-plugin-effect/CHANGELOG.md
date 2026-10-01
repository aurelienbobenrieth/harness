# @aurelienbbn/oxlint-plugin-effect

## 0.7.0

### Minor Changes

- [#49](https://github.com/aurelienbobenrieth/harness/pull/49) [`4f758c5`](https://github.com/aurelienbobenrieth/harness/commit/4f758c5da4e618239a276ce7f0d2060eee5fa358) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `effect/telemetry-name-format` gains an opt-in `logMessages` option. With `logMessages: true`, the first argument of `Effect.log`, `logTrace`, `logDebug`, `logInfo`, `logWarning`, `logError` and `logFatal` is an event name: a literal in the span name format (`pattern`, `minSegments`), like `Effect.logInfo("webhook.rejected", { attempt })`. Variables, templates with values and concatenations are reported too. Without the option the rule behaves as before.

## 0.6.0

### Minor Changes

- [#43](https://github.com/aurelienbobenrieth/harness/pull/43) [`2c81ff6`](https://github.com/aurelienbobenrieth/harness/commit/2c81ff6acd1b2a4a3b2913924073415ff340eb9c) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Adds two opt-in naming rules. `effect/schema-literal-case` keeps the string values of `Schema.Literals([...])` in one case (`case`: `"snake"` by default, or `"kebab"`, `"camel"`, `"pascal"`). `effect/telemetry-name-format` requires literal span names (`Effect.fn`, `withSpan` and the other span constructors) and `Rpc.make` tags in lowercase dotted snake_case with at least two segments (`orders.sync`), and log and span annotation keys in lowercase dotted snake_case (options `pattern`, `keyPattern`, `minSegments`). It conflicts with `effect/effect-fn-name-matches-binding`: enable one or the other. Neither rule autofixes.

## 0.5.0

### Minor Changes

- [#39](https://github.com/aurelienbobenrieth/harness/pull/39) [`600ed27`](https://github.com/aurelienbobenrieth/harness/commit/600ed273aed70a8cb7475f70403720929894df56) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `@aurelienbbn/oxlint-plugin-effect` adds `effect/no-array-method-this-argument` and `effect/no-array-sort`, completing the Effect-aware array checks: unicorn's versions report Effect's data-first helpers (`Arr.filter(xs, f)`, where `f` is taken for a `thisArg`) and `Arr.sort(order)`, which returns a new array. `@aurelienbbn/oxlint-config`'s `effectIdiomRules` turns the two unicorn rules off in favor of them.

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
