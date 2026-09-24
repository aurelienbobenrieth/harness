# @aurelienbbn/oxlint-plugin-effect

**32 oxlint rules for Effect code: runtime boundaries, failure channels, concurrency, services, Schema. Only what `@effect/tsgo` doesn't own.**

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
  floating Effects · missing yield* / return yield* · unsafe assertions & channels
  Effect-native globals & JSON · deterministic ids · Effect.fn opportunities · Layer provision
        │
        ▼
@aurelienbbn/oxlint-plugin-effect        ← policies and syntactic failure modes tsgo doesn't own
```

**Type-dependent conclusions stay with `@effect/tsgo`.** Ownership: [`docs/rule-ownership.md`](../../docs/rule-ownership.md); the catalog gate enforces the inventory.

## What fires

```ts
const values = Effect.all(programs); // ❌ require-all-concurrency
const values = Effect.all(programs, { concurrency: 1 }); // ✅ explicit choice

const program = Effect.fail("boom"); // ❌ require-tagged-effect-fail
const program = Effect.fail(new DomainError({ reason })); // ✅ tagged error

Effect.tryPromise(() => fetch(url)); // ❌ no-untyped-try-promise-catch, require-abort-signal
Effect.tryPromise({
  try: (signal) => fetch(url, { signal }),
  catch: (cause) => new HttpError({ cause }), // ✅ typed, cause kept, signal forwarded
});
```

- **Concurrency rules demand an explicit choice**; they don't claim omitted concurrency is unbounded.
- **Same `allow` paths on `no-run-promise-in-runtime` and `no-unscoped-runtime-launch`:** shared boundary matching.
- 🎨 `dependencies-first`, `no-switch`, `prefer-match`, `prefer-effect-array-helpers`, `schema-type-adjacent` are opinionated. **Suppress at the exceptional call site**, not in the shared config.

<details>
<summary>32 rules by job</summary>

| Job                       | Rules                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🚨 failures (9)           | `no-catch-all-cause`, `no-effect-ordie`, `no-swallowed-failure`, `no-untyped-try-promise-catch`, `preserve-thrown-cause`, `no-unsafe-error-mapper`, `require-tagged-effect-fail`, `no-effect-promise`, `bounded-retry` |
| 🚪 runtime boundaries (5) | `no-run-promise-in-runtime`, `no-unscoped-runtime-launch`, `prefer-run-main`, `no-fork-detach`, `prefer-it-effect` (opt-in, needs `@effect/vitest`)                                                                    |
| 🧬 bodies & tracing (4)   | `no-unsafe-effect-body`, `require-named-effect-fn`, `effect-fn-name-matches-binding`, `dependencies-first` 🎨                                                                                                          |
| 🧩 services & layers (4)  | `no-service-constructor-imports`, `no-service-dependency-parameters`, `no-service-option`, `no-static-service-forwarders`                                                                                              |
| 📐 Schema & config (4)    | `no-schema-any`, `prefer-schema-decode-unknown`, `schema-type-adjacent` 🎨, `require-redacted-secret-config`                                                                                                           |
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

## 0 autofix, 5 suggestions

**No rule has one behavior-preserving rewrite:** error type, runtime boundary, concurrency policy, layer owner, tracing name, and platform adapter need project knowledge.

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

## Contract

| Topic          | Contract                                                                          |
| -------------- | --------------------------------------------------------------------------------- |
| Effect version | exercised on `4.0.0-rc.115`. ⚠️ Effect 3/4 spellings not promised interchangeable |
| imports        | namespace and aliased imports recognized; local shadows ignored                   |
| overlap        | `@effect/tsgo`'s type-aware diagnostics win                                       |

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                         | Trigger or review scope                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bounded-retry`                    | Require Effect.retry policies visible in the same file to carry a bound such as Schedule.recurs, Schedule.upTo, Schedule.during, times, while, or until.                |
| `dependencies-first`               | Yield service dependencies before runtime logic in Effect bodies.                                                                                                       |
| `effect-fn-name-matches-binding`   | Require the last dot-segment of an Effect.fn span name to equal the variable or property the function is bound to.                                                      |
| `no-catch-all-cause`               | Disallow Effect.catchCause, catchCauseIf, catchCauseFilter, sandbox, Layer.catchCause, and Effect 3 catchAllCause because they catch defects.                           |
| `no-effect-ordie`                  | Disallow Effect.orDie, Effect.orDieWith, Layer.orDie, and Effect.catch handlers that only die outside configured escape hatches.                                        |
| `no-effect-promise`                | Disallow Effect.promise outside configured files unless the thunk is a syntactically total promise such as Promise.resolve or a resolve-only timer.                     |
| `no-fork-detach`                   | Disallow Effect.forkDetach outside configured files and Effect.forkChild directly inside Layer constructors, where Effect.forkScoped ties the fiber to the layer scope. |
| `no-run-promise-in-runtime`        | Disallow Effect.runPromise, runPromiseExit, and their run*With variants outside configured runtime boundaries.                                                          |
| `no-schema-any`                    | Disallow Schema.Any outside configured escape-hatch files.                                                                                                              |
| `no-service-constructor-imports`   | Disallow make-prefixed imports from project service directories into runtime code.                                                                                      |
| `no-service-dependency-parameters` | Disallow service projection types and configured service names in parameters.                                                                                           |
| `no-service-option`                | Disallow Effect.serviceOption in favor of required services provided by layers.                                                                                         |
| `no-static-service-forwarders`     | Disallow static class properties that only forward to an Effect service method.                                                                                         |
| `no-swallowed-failure`             | Disallow Effect.ignore without a log option and Effect.catch handlers that discard the error and succeed with a placeholder.                                            |
| `no-switch`                        | Disallow switch statements in Effect code in favor of Match.                                                                                                            |
| `no-unsafe-effect-body`            | Disallow throw, await, try blocks around yield*, and global timers inside Effect.gen, Effect.fn, and Effect.fnUntraced bodies.                                          |
| `no-unsafe-error-mapper`           | Disallow unknown and any in Effect error mapper parameters.                                                                                                             |
| `no-unscoped-runtime-launch`       | Disallow Effect.runFork, runSync, runSyncExit, runCallback, their run*With variants, and Layer.launch outside configured runtime boundaries.                            |
| `no-untyped-try-promise-catch`     | Require Effect.try and Effect.tryPromise to map thrown or rejected values with a catch handler.                                                                         |
| `prefer-effect-array-helpers`      | Prefer Effect array helpers over native array helper methods.                                                                                                           |
| `prefer-it-effect`                 | Prefer it.effect from @effect/vitest over Effect.runPromise or Effect.runSync inside plain it/test callbacks in test files (opt-in; requires @effect/vitest).           |
| `prefer-match`                     | Prefer Match from effect over chained literal ternaries.                                                                                                                |
| `prefer-run-main`                  | Prefer NodeRuntime.runMain or BunRuntime.runMain over a module top-level Effect.runPromise or Effect.runFork statement.                                                 |
| `prefer-schema-decode-unknown`     | Require Schema decodeUnknown variants when decoding unknown boundary values.                                                                                            |
| `preserve-thrown-cause`            | Require Effect.try and Effect.tryPromise catch mappers to use the thrown value they receive.                                                                            |
| `require-abort-signal`             | Require Effect.tryPromise and Effect.promise thunks that call fetch (or configured abortable calls) to accept the AbortSignal parameter and pass it on.                 |
| `require-all-concurrency`          | Require explicit concurrency for Effect.all.                                                                                                                            |
| `require-for-each-concurrency`     | Require explicit concurrency for Effect.forEach.                                                                                                                        |
| `require-named-effect-fn`          | Require Effect.fn calls to include a non-empty name.                                                                                                                    |
| `require-redacted-secret-config`   | Require Config.Redacted instead of Config.String or Config.NonEmptyString for configuration keys whose name looks like a secret.                                        |
| `require-tagged-effect-fail`       | Require tagged error values for Effect.fail and Effect.failSync, rejecting literals, native Errors, and same-file untagged Error subclasses.                            |
| `schema-type-adjacent`             | Keep a Schema's matching type alias adjacent, allowing whitespace and JSDoc.                                                                                            |

### Credited concepts

- @effect/language-service diagnostics tryCatchInEffectGen and globalTimersInEffect (concept)
- Effect bundled AGENTS.md "The name string should match the function name" (concept)
- Effect bundled ai-docs "capped exponential backoff with jitter and max attempts" pattern (concept)
- Effect bundled ai-docs `catch: (cause) => new X({ cause })` convention (concept)
- ai-automation by Sandro Maglione (inspiration, independently re-implemented)
- anti-slop by Dillon Mulroy (MIT, concept re-implemented)

<!-- harness-catalog:end -->
