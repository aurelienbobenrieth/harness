# @aurelienbbn/oxlint-plugin-effect

## 0.9.0

### Minor Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Remove the duplicate Knip wrapper; run Knip directly for unused files, exports and dependencies. Add advisory snapshot ancestry, migration SQL, retention metadata, calendar schema, destructive reason and fenced JSDoc checks. Publish Windows-compatible commit-message attribution hooks. Keep statement spacing in post-oxfmt formatting.

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Narrow the Effect failure, runtime-boundary and concurrency rules to the code they are right about.

  `@aurelienbbn/oxlint-plugin-effect`:

  - Test files and test-support folders (`testing/`, `fixtures/`, `e2e/`, `typetest/`, `scripts/`, `*.test.*`, `*.tst.*`) are skipped by default in `no-effect-ordie`, `no-effect-promise`, `no-fork-detach`, `no-catch-all-cause`, `no-unsafe-effect-body`, `no-untyped-try-promise-catch`, `preserve-thrown-cause`, `bounded-retry`, `require-all-concurrency`, `require-for-each-concurrency`, `require-tagged-effect-fail`, `require-abort-signal` and `no-swallowed-failure`; a failing seed or an assertion `throw` is a bug in the test, not a domain outcome. The ten rules that had no options gain an `allow` option; set it to replace the default.
  - `no-effect-promise` allows `Effect.promise` in finalizers (`acquireRelease` release, `acquireUseRelease` release, `addFinalizer`, `ensuring`, `onExit`, `onInterrupt`), whose error channel must stay empty.
  - `no-catch-all-cause` allows a cause handler that hands its cause back with `Effect.failCause(cause)`: it recovers selectively and defects stay failed.
  - `require-tagged-effect-fail` accepts `{ _tag: "X" as const }`, `{ _tag: "X" } as const` and `satisfies` (it reported them as untagged).
  - `no-run-promise-in-runtime` and `no-unscoped-runtime-launch` allow a handler of a default-exported Worker module object (`fetch`, `scheduled`, `queue`, `email`, `tail`, `trace`) and a browser entry file (touches `document`/`window` or imports a stylesheet); `no-unscoped-runtime-launch` allows `Layer.launch` handed to `runMain`.
  - `prefer-run-main` skips browser entry files, where `NodeRuntime.runMain` does not exist.
  - `prefer-it-effect` reports in test files that import Effect (`effect`, `effect/*`, `@effect/*`), whether or not they import `@effect/vitest`; the new option `requireEffectVitestImport: true` restores the narrow behaviour for a project that cannot install the package. Non-Effect test files stay silent.
  - `no-swallowed-failure` no longer reports `Effect.orElseSucceed(() => default)`: an explicit fallback is a decision, not a swallow. `Effect.ignore` without a log and placeholder `Effect.catch` handlers still report.
  - `require-redacted-secret-config` treats a `PUBLIC_` key as public.
  - New rule `no-native-failure`: in files importing `effect`, `effect/*` or `@effect/*`, `try`/`catch` and `throw` report, with `Effect.fail` of a tagged error or `Effect.try` as the fix. Legal: anything inside the callback of `Effect.try` / `Effect.tryPromise`, `try`/`finally` without `catch`, and `throw redirect()` / `throw notFound()` imported from a router framework. A `throw` directly in an `Effect.gen`/`Effect.fn` body stays `no-unsafe-effect-body`'s and a `try`/`catch` there `effecttsgo/try-catch-in-effect-gen`'s, so nothing reports twice. Test-support files are exempt through `allow`.
  - New rule `no-tagged-error-name-field`: a field called `name` in the payload of a `Schema.TaggedError`, `Schema.TaggedErrorClass` or `Data.TaggedError` class shadows `Error.name`; use a domain-specific field such as `queueName`. Idea from crosshatch/traits (Apache-2.0), implemented independently.
  - Removed `no-unsafe-error-mapper`.

  Cut false positives in the style and array rules after auditing them on Effect libraries, Effect apps and non-Effect code:

  - `prefer-effect-array-helpers` and `no-service-constructor-imports` read only files that import Effect (one project carried 102 suppressions for root Node tools).
  - `no-array-callback-reference` allows `Number`, `String`, `BigInt` and local functions that cannot read the index; `no-array-sort` and `no-array-method-this-argument` skip query-builder `sort({...})` and capitalized receivers such as `Query.find(Model, filter)`.
  - `effect-fn-name-matches-binding` accepts the snake_case spelling of the binding, so it no longer conflicts with `telemetry-name-format`; `telemetry-name-format`, `prefer-match` and `require-named-effect-fn` skip tests by default (`allow`).
  - `tagged-error-name` accepts a namespaced `_tag` that ends with the class name; `schema-literal-case` skips generated files, flags, paths and symbols and takes `allowedValues`; `schema-domain-types` skips recursive types and interfaces extending runtime handles; `no-service-option` allows `ParentSpan` and `allowedServices`; `no-service-dependency-parameters` no longer reports `Context.Service` tag types or lowercase SDK namespaces such as `ecs.Service`.

  Scope `prefer-effect-array-helpers` to imported Effect runtime callbacks, excluding non-Effect assets and utilities in mixed files. Remove the array-helper advisory override after a 10/10 consumer precision check.

  Resolve Vitest fake-timer utilities by import identity, including aliases and namespace members, while ignoring other exports renamed `vi`.

## 0.8.1

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `telemetry-name-format` recognizes `Rpc.make` imported from `effect/rpc` and `effect/rpc/Rpc`, where Effect 4.0.0 moved the RPC module from `effect/unstable/rpc`.

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.8.0

### Minor Changes

- [#57](https://github.com/aurelienbobenrieth/harness/pull/57) [`dd8356d`](https://github.com/aurelienbobenrieth/harness/commit/dd8356d4a0c09c333e36a4e082729eebf3709737) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Adds `effect/schema-check-branded`: in a domain folder (`**/domain/**` by default, option `files`; tests and scripts skipped, option `allow`), a schema that adds a check (`Schema.check(...)` in a pipe, or a `.check(...)` call) with no `Schema.brand` in the same chain is reported. A check runs only on decode, encode and `make`, so without a brand its type is the unchecked one and code can build a value the check refuses. No autofix.

- [#56](https://github.com/aurelienbobenrieth/harness/pull/56) [`8d2ed41`](https://github.com/aurelienbobenrieth/harness/commit/8d2ed41bf0f9ca01d4535c5f3620707f26f12b71) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Adds `effect/schema-domain-types`: in a domain folder (`**/domain/**` by default, option `files`; tests and scripts skipped, option `allow`), an interface, an object type alias (bare, in `Readonly<>`, an array, a union or an intersection), a union of literal types or an enum is reported, so the domain is declared as Schemas (`Schema.Struct`, `Schema.TaggedStruct`, `Schema.Union`, `Schema.Literals`) with the type derived by `typeof X.Type`. Generic declarations, declarations holding behavior or runtime handles (`Schema.*`, `Effect.*` members), unions of named types and an empty interface extending a schema type stay silent. No autofix.

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
