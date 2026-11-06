---
"@aurelienbbn/oxlint-plugin-effect": minor
---

Narrow the Effect failure, runtime-boundary and concurrency rules to the code they are right about.

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

Scope the three array rules to imported Effect runtime callbacks, excluding non-Effect assets and utilities in mixed files. Remove the array-helper advisory override after a 10/10 consumer precision check.

Resolve Vitest fake-timer utilities by import identity, including aliases and namespace members, while ignoring other exports renamed `vi`.
