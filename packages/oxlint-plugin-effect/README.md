# @aurelienbbn/oxlint-plugin-effect

Opinionated Oxlint rules for Effect projects. Consumers enable the rules they want from the plugin export.

## Upstream ownership

Use the official `@effect/tsgo` recommended Oxlint preset first. It owns typed Effect diagnostics, including floating Effects, missing `yield*`/`return yield*`, unsafe Effect assertions and channels, Effect-native globals and JSON operations, deterministic identifiers, `Effect.fn` opportunities, and Layer provision structure.

This plugin contains only policies or syntactic failure modes not owned by that preset. The official diagnostics are type-aware and have priority whenever an overlap emerges. Upstream ownership is recorded in [`docs/rule-ownership.md`](../../docs/rule-ownership.md) and the exported inventory is enforced by the catalog gate.

## Fix policy

Autofix is provided only when one mechanical rewrite preserves behavior. The remaining rules report because choosing an error type, runtime boundary, concurrency policy, layer owner, tracing name, or platform adapter requires project knowledge.

## Contract boundaries

Compatibility is exercised against Effect `4.0.0-rc.115`; this is not a promise that every Effect 3/4 spelling is interchangeable. Import-aware recognizers cover namespace and aliased imports and ignore local shadows. Type-dependent conclusions remain with `@effect/tsgo` rather than being approximated here.

Architecture preferences such as `dependencies-first`, `no-switch`, `prefer-match`, `prefer-effect-array-helpers`, and `schema-type-adjacent` are intentionally opinionated. Consumers can suppress a rule at an exceptional call site instead of weakening the shared configuration.

Runtime rules share boundary matching: `no-run-promise-in-runtime` owns promise runners; `no-unscoped-runtime-launch` owns fork, sync, callback, and Layer launches. Configure the same allowed boundary paths for both. Concurrency rules require an explicit choice; omitted concurrency is not asserted to be unbounded.

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
