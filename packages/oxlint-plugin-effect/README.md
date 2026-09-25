# @aurelienbbn/oxlint-plugin-effect

[![npm](https://img.shields.io/npm/v/@aurelienbbn/oxlint-plugin-effect)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-effect) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/oxlint-plugin-effect)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-effect) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/oxlint-plugin-effect)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-effect/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/oxlint-plugin-effect)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-effect/package.json)

**35 oxlint rules for Effect code: runtime boundaries, failure channels, concurrency, services, Schema. Only what `@effect/tsgo` doesn't own.**

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-effect oxlint   # oxlint >=1.82.0 <2.0.0
```

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-effect"],
  "rules": {
    "effect/require-all-concurrency": "error",
    "effect/require-tagged-effect-fail": "error",
    "effect/no-run-promise-in-runtime": ["error", { "allow": ["**/src/main.ts"] }]
  }
}
```

No preset: enable each rule by name.

## Upstream first, this plugin second

```text
@effect/tsgo recommended oxlint preset   ← enable FIRST, wins every overlap (type-aware)
  floating Effects · missing yield* / return yield* · Effect-native globals & JSON
  Effect.fn opportunities · try/catch and timers in generators · class Self mismatch
        +
withEffectTsgoLayer extras               ← @aurelienbbn/oxlint-config; off in recommended
  any/unknown in error & requirements channels · unsafe Effect type assertions
  deterministic service/error keys · Effect.provide outside entry points
        │
        ▼
@aurelienbbn/oxlint-plugin-effect        ← policies and syntactic failure modes tsgo doesn't own
```

**Wire tsgo with `withEffectTsgoLayer` from `@aurelienbbn/oxlint-config`**: it adds the four extras and settles every overlap with this plugin in one table. Mind its version lock: `@effect/tsgo` 0.45.0 accepts only oxlint 1.81.0 / 1.82.0 and oxlint-tsgolint 7.0.2001.

| 13 rules removed in favor of tsgo                                                                                                                                        | Owner                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `no-floating-effect`, `no-plain-yield`, `require-return-on-failure-yield`, `prefer-effect-fn`, `no-raw-json-parse`, `no-raw-json-stringify`, `no-ambient-nondeterminism` | ✅ `recommended`                                                               |
| `no-effect-type-assertion`, `no-unsafe-error-channel`, `matching-identifier`                                                                                             | ⚠️ only with `withEffectTsgoLayer` (or tsgo's `correctness` + `style` presets) |
| `no-nested-layer-provide`, `no-cascading-layer-provide`, `use-root-imports`                                                                                              | ❌ no exact owner                                                              |

**Type-dependent conclusions stay with `@effect/tsgo`.** Ownership: [`docs/rule-ownership.md`](../../docs/rule-ownership.md); the catalog gate enforces the inventory.

## What fires

```ts
const values = Effect.all(programs); // ❌ require-all-concurrency
const values = Effect.all(programs, { concurrency: 1 }); // ✅ explicit choice

const program = Effect.fail("boom"); // ❌ require-tagged-effect-fail
const program = Effect.fail(new DomainError({ reason })); // ✅ tagged error

const load = (id: string) => Effect.fn(`users.load.${id}`)(body); // ❌ no-dynamic-span-name
const load = Effect.fn("users.load")(body); // ✅ ids go in span attributes

Effect.tryPromise(() => fetch(url)); // ❌ no-untyped-try-promise-catch, require-abort-signal
Effect.tryPromise({
  try: (signal) => fetch(url, { signal }),
  catch: (cause) => new HttpError({ cause }), // ✅ typed, cause kept, signal forwarded
});
```

- **Concurrency rules demand an explicit choice**; they don't claim omitted concurrency is unbounded.
- **Same `allow` paths on `no-run-promise-in-runtime` and `no-unscoped-runtime-launch`:** shared boundary matching.
- 🎨 `dependencies-first`, `padding-after-dependencies`, `no-switch`, `prefer-match`, `prefer-effect-array-helpers`, `schema-type-adjacent` are opinionated. **Suppress at the exceptional call site**, not in the shared config.

<details>
<summary>35 rules by job</summary>

| Job                       | Rules                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🚨 failures (9)           | `no-catch-all-cause`, `no-effect-ordie`, `no-swallowed-failure`, `no-untyped-try-promise-catch`, `preserve-thrown-cause`, `no-unsafe-error-mapper`, `require-tagged-effect-fail`, `no-effect-promise`, `bounded-retry` |
| 🚪 runtime boundaries (7) | `no-run-promise-in-runtime`, `no-unscoped-runtime-launch`, `prefer-run-main`, `no-fork-detach`, `no-managed-runtime-per-call`, `prefer-it-effect` (opt-in, needs `@effect/vitest`), `no-fake-timers-in-effect-tests`   |
| 🧬 bodies & tracing (6)   | `no-unsafe-effect-body`, `require-named-effect-fn`, `effect-fn-name-matches-binding`, `no-dynamic-span-name`, `dependencies-first` 🎨, `padding-after-dependencies` 🎨                                                 |
| 🧩 services & layers (4)  | `no-service-constructor-imports`, `no-service-dependency-parameters`, `no-service-option`, `no-static-service-forwarders`                                                                                              |
| 📐 Schema & config (3)    | `no-schema-any`, `schema-type-adjacent` 🎨, `require-redacted-secret-config`                                                                                                                                           |
| ⚡ concurrency (3)        | `require-all-concurrency`, `require-for-each-concurrency`, `require-abort-signal`                                                                                                                                      |
| 🎨 style (3)              | `no-switch`, `prefer-match`, `prefer-effect-array-helpers`                                                                                                                                                             |

</details>

<details>
<summary>Options and defaults</summary>

`tests` = `**/*.{test,spec}.{ts,tsx}`.

| Rule                               | Option                  | Default                                                                                                     |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `no-run-promise-in-runtime`        | `allow`                 | tests, `**/scripts/**`                                                                                      |
| `no-unscoped-runtime-launch`       | `allow`                 | tests, `**/scripts/**`                                                                                      |
| `prefer-run-main`                  | `allow`                 | tests, `**/scripts/**`                                                                                      |
| `no-managed-runtime-per-call`      | `allow`                 | tests, `**/scripts/**`                                                                                      |
| `prefer-effect-array-helpers`      | `allow`                 | tests, `**/scripts/**`                                                                                      |
|                                    | `ignoredObjects`        | `Array`, `Arr`, `Effect`, `HashMap`, `HashSet`, `Match`, `Option`, `Record`, `Schedule`, `Schema`, `Stream` |
| `no-schema-any`                    | `allow`                 | tests, `**/fixtures/**`, `**/scripts/**`, `tools/**`                                                        |
| `no-effect-ordie`                  | `allow`, `allowedCalls` | `[]`, `[]`                                                                                                  |
| `no-effect-promise`                | `allow`                 | `[]`                                                                                                        |
|                                    | `mode`                  | `"all"` · or `"rejectable-only"`                                                                            |
| `no-fork-detach`                   | `allow`                 | `[]`                                                                                                        |
| `no-swallowed-failure`             | `allowInFinalizers`     | `true`                                                                                                      |
| `prefer-it-effect`                 | `testFiles`             | tests                                                                                                       |
| `require-abort-signal`             | `abortableCalls`        | `["fetch"]`                                                                                                 |
| `require-redacted-secret-config`   | `secretPattern`         | `(SECRET\|PASSWORD\|PASSWD\|TOKEN\|API_?KEY\|PRIVATE_?KEY\|CREDENTIAL\|DATABASE_URL\|_DSN$)`                |
|                                    | `benignPattern`         | `_(TTL\|LENGTH\|NAME\|HEADER\|URL_PREFIX\|COUNT\|ENABLED)$`                                                 |
| `effect-fn-name-matches-binding`   | `ignorePattern`         | none                                                                                                        |
| `no-service-constructor-imports`   | `serviceModules`        | none (project-local sources always count)                                                                   |
| `no-service-dependency-parameters` | `serviceTypeNames`      | `[]`                                                                                                        |

</details>

## 1 autofix, 5 suggestions

**Only `padding-after-dependencies` has one behavior-preserving rewrite:** it inserts the blank line below the leading service dependencies. Every other fix needs project knowledge: error type, runtime boundary, concurrency policy, layer owner, tracing name, platform adapter.

```ts
Effect.gen(function* () {
  const repo = yield* UserRepo;
  const user = yield* repo.findUser(id); // ❌ padding-after-dependencies
});

Effect.gen(function* () {
  const repo = yield* UserRepo;

  const user = yield* repo.findUser(id); // ✅ dependencies stand apart
});
```

<details>
<summary>The 5 editor suggestions</summary>

| Rule                             | Suggests                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| `require-abort-signal`           | forward the thunk's `signal` into `fetch`                     |
| `effect-fn-name-matches-binding` | rename the span to the binding name                           |
| `no-fork-detach`                 | `forkChild` → `forkScoped` inside a Layer constructor         |
| `no-swallowed-failure`           | add `{ log: true }` to `Effect.ignore`                        |
| `require-redacted-secret-config` | `Config.String` / `Config.NonEmptyString` → `Config.Redacted` |

</details>

## Migration

| Change                                               | Why                                                                                                                                                                                                         | Now                                                                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefer-schema-decode-unknown` removed               | Effect 4's typed decoders (`decodeSync`, `decodeEffect`, …) take `S["Encoded"]`, so `as unknown` input fails typecheck; `decodeEither` no longer exists                                                     | `effecttsgo/prefer-schema-over-json` reports `JSON.parse`, `typescript/no-explicit-any` reports `as any`. Drop the rule from your config        |
| `no-unsafe-effect-body` keeps only `throw`           | try/catch and global timers in generators are `effecttsgo/try-catch-in-effect-gen` and `effecttsgo/global-timers-in-effect` (both in `recommended`); `Effect.gen` rejects an `async function*` at typecheck | same rule name, no config change. ⚠️ `try`/`finally` around `yield*` without `catch` has no verified tsgo owner                                 |
| `no-catch-all-cause`, `no-swallowed-failure` widened | tsgo's `catch-to-ignore` / `catch-to-or-else-succeed` rewrites led to `Effect.ignoreCause` and `Effect.orElseSucceed(() => placeholder)`, which passed silently                                             | `Effect.ignoreCause`, `Effect.catchDefect` report under `no-catch-all-cause`; a placeholder `Effect.orElseSucceed` under `no-swallowed-failure` |

## Contract

| Topic          | Contract                                                                          |
| -------------- | --------------------------------------------------------------------------------- |
| Effect version | exercised on `4.0.0-rc.115`. ⚠️ Effect 3/4 spellings not promised interchangeable |
| imports        | namespace and aliased imports recognized; local shadows ignored                   |
| overlap        | `@effect/tsgo`'s type-aware diagnostics win; settled in `withEffectTsgoLayer`     |

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                         | Trigger or review scope                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bounded-retry`                    | Require Effect.retry policies visible in the same file to carry a bound such as Schedule.recurs, Schedule.upTo, Schedule.during, times, while, or until.                                                     |
| `dependencies-first`               | Yield service dependencies before runtime logic in Effect bodies.                                                                                                                                            |
| `effect-fn-name-matches-binding`   | Require the last dot-segment of an Effect.fn span name to equal the variable or property the function is bound to.                                                                                           |
| `no-catch-all-cause`               | Disallow Effect.catchCause, catchCauseIf, catchCauseFilter, catchDefect, ignoreCause, sandbox, Layer.catchCause, and Effect 3 catchAllCause because they catch defects.                                      |
| `no-dynamic-span-name`             | Disallow template literals with runtime values and string concatenation as span names in Effect.fn, Effect.withSpan, withSpanScoped, useSpan, makeSpan, makeSpanScoped, Layer.withSpan, and Stream.withSpan. |
| `no-effect-ordie`                  | Disallow Effect.orDie, Effect.orDieWith, Layer.orDie, and Effect.catch handlers that only die outside configured escape hatches.                                                                             |
| `no-effect-promise`                | Disallow Effect.promise outside configured files unless the thunk is a syntactically total promise such as Promise.resolve or a resolve-only timer.                                                          |
| `no-fake-timers-in-effect-tests`   | Disallow vi.useFakeTimers, vi.advanceTimers*, vi.run*Timers, and vi.setSystemTime in files importing @effect/vitest; use TestClock.                                                                          |
| `no-fork-detach`                   | Disallow Effect.forkDetach outside configured files and Effect.forkChild directly inside Layer constructors, where Effect.forkScoped ties the fiber to the layer scope.                                      |
| `no-managed-runtime-per-call`      | Disallow ManagedRuntime.make inside function bodies outside configured files; build the runtime once at module scope.                                                                                        |
| `no-run-promise-in-runtime`        | Disallow Effect.runPromise, runPromiseExit, and their run*With variants outside configured runtime boundaries.                                                                                               |
| `no-schema-any`                    | Disallow Schema.Any outside configured escape-hatch files.                                                                                                                                                   |
| `no-service-constructor-imports`   | Disallow make-prefixed imports from project service directories into runtime code.                                                                                                                           |
| `no-service-dependency-parameters` | Disallow service projection types and configured service names in parameters.                                                                                                                                |
| `no-service-option`                | Disallow Effect.serviceOption in favor of required services provided by layers.                                                                                                                              |
| `no-static-service-forwarders`     | Disallow static class properties that only forward to an Effect service method.                                                                                                                              |
| `no-swallowed-failure`             | Disallow Effect.ignore without a log option, and Effect.catch handlers or Effect.orElseSucceed fallbacks that discard the error for a placeholder.                                                           |
| `no-switch`                        | Disallow switch statements in Effect code in favor of Match.                                                                                                                                                 |
| `no-unsafe-effect-body`            | Disallow throw inside Effect.gen, Effect.fn, and Effect.fnUntraced bodies.                                                                                                                                   |
| `no-unsafe-error-mapper`           | Disallow unknown and any in Effect error mapper parameters.                                                                                                                                                  |
| `no-unscoped-runtime-launch`       | Disallow Effect.runFork, runSync, runSyncExit, runCallback, their run*With variants, and Layer.launch outside configured runtime boundaries.                                                                 |
| `no-untyped-try-promise-catch`     | Require Effect.try and Effect.tryPromise to map thrown or rejected values with a catch handler.                                                                                                              |
| `padding-after-dependencies`       | Require a blank line after the leading service dependencies of an Effect.gen, Effect.fn, or Effect.fnUntraced generator body when logic follows them.                                                        |
| `prefer-effect-array-helpers`      | Prefer Effect array helpers over native array helper methods.                                                                                                                                                |
| `prefer-it-effect`                 | Prefer it.effect from @effect/vitest over Effect.runPromise or Effect.runSync inside plain it/test callbacks in test files (opt-in; requires @effect/vitest).                                                |
| `prefer-match`                     | Prefer Match from effect over chained literal ternaries.                                                                                                                                                     |
| `prefer-run-main`                  | Prefer NodeRuntime.runMain or BunRuntime.runMain over a module top-level Effect.runPromise or Effect.runFork statement.                                                                                      |
| `preserve-thrown-cause`            | Require Effect.try and Effect.tryPromise catch mappers to use the thrown value they receive.                                                                                                                 |
| `require-abort-signal`             | Require Effect.tryPromise and Effect.promise thunks that call fetch (or configured abortable calls) to accept the AbortSignal parameter and pass it on.                                                      |
| `require-all-concurrency`          | Require explicit concurrency for Effect.all.                                                                                                                                                                 |
| `require-for-each-concurrency`     | Require explicit concurrency for Effect.forEach.                                                                                                                                                             |
| `require-named-effect-fn`          | Require Effect.fn calls to include a non-empty name.                                                                                                                                                         |
| `require-redacted-secret-config`   | Require Config.Redacted instead of Config.String or Config.NonEmptyString for configuration keys whose name looks like a secret.                                                                             |
| `require-tagged-effect-fail`       | Require tagged error values for Effect.fail and Effect.failSync, rejecting literals, native Errors, and same-file untagged Error subclasses.                                                                 |
| `schema-type-adjacent`             | Keep a Schema's matching type alias adjacent, allowing whitespace and JSDoc.                                                                                                                                 |

### Credited concepts

- Effect bundled AGENTS.md "The name string should match the function name" (concept)
- Effect bundled ai-docs "capped exponential backoff with jitter and max attempts" pattern (concept)
- Effect bundled ai-docs `04_integration/10_managed-runtime.ts` module-level runtime (concept)
- Effect bundled ai-docs `09_testing/10_effect-tests.ts` "controls time with TestClock" (concept)
- Effect bundled ai-docs `catch: (cause) => new X({ cause })` convention (concept)
- OpenTelemetry Tracing API specification, span name guidance "most general string ... low cardinality" (Apache-2.0, concept)
- ai-automation by Sandro Maglione (inspiration, independently re-implemented)
- anti-slop by Dillon Mulroy (MIT, concept re-implemented)

<!-- harness-catalog:end -->
