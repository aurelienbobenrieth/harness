# @aurelienbbn/oxlint-plugin-effect

Custom oxlint rules for projects that use Effect.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

## Autofix

`effect/no-plain-yield` inserts the missing `*`; a plain `yield` has no valid meaning inside an Effect generator.
`effect/require-return-on-failure-yield` prepends `return`; the statement never completes normally, so control flow is unchanged.
`effect/matching-identifier`, `effect/effect-fn-name-matches-binding`, `effect/no-swallowed-failure`, `effect/require-redacted-secret-config`, `effect/no-fork-detach`, and `effect/require-abort-signal` offer editor suggestions only, because persisted tags, call sites, or fiber ownership need a human decision.
`effect/preserve-thrown-cause`, `effect/no-effect-promise`, `effect/prefer-effect-fn`, `effect/prefer-it-effect`, `effect/prefer-run-main`, `effect/no-effect-type-assertion`, and `effect/bounded-retry` are not autofixable because the rewrite requires choosing an error type, a platform runtime, or a retry policy.

`effect/dependencies-first` is not autofixable because moving dependency yields can change when Effects are constructed or executed.
`effect/no-ambient-nondeterminism` is not autofixable because replacing ambient reads requires threading the Clock, DateTime, or Random service through the surrounding Effect.
`effect/no-cascading-layer-provide` is not autofixable because merging provision steps requires knowing whether the provided layers are independent or depend on each other.
`effect/no-catch-all-cause` is not autofixable because replacing it requires choosing the intended expected-error handler and defect policy.

`effect/no-effect-ordie` is not autofixable because replacing defect conversion requires choosing the intended typed failure or explicit defect boundary.
`effect/no-nested-layer-provide` is not autofixable because extracting the configured layer requires choosing a meaningful name and placement for it.
`effect/no-service-constructor-imports` is not autofixable because replacing a constructor import requires knowing the owning Layer and rewriting call sites to yield the contextual service.
`effect/no-service-option` is not autofixable because requiring the service directly changes the requirements channel and the layer composition.
`effect/no-static-service-forwarders` is not autofixable because removing a forwarder requires rewriting every call site to yield the service.
`effect/no-switch` is not autofixable because translating cases into a Match pipeline requires choosing the matcher shape and exhaustiveness policy.
`effect/no-unsafe-error-channel` is not autofixable because replacing `unknown` or `any` requires choosing a typed domain/infra error or confirming the Effect is truly infallible.
`effect/no-unsafe-effect-body` is not autofixable because replacing `throw` or `await` requires choosing the correct typed failure, defect, or promise adapter.
`effect/no-unsafe-error-mapper` is not autofixable because replacing broad error parameters requires choosing a typed failure union or explicit boundary helper.
`effect/no-unscoped-runtime-launch` is not autofixable because moving runtime launch calls requires choosing the application boundary.
`effect/prefer-effect-array-helpers` is not autofixable because the right Effect helper and concurrency/error behavior depends on intent.
`effect/prefer-match` is not autofixable because rewriting a ternary chain into a Match pipeline requires choosing the matcher shape and fallback handling.
`effect/prefer-schema-decode-unknown` is not autofixable because choosing the exact sync/effect/either/promise decodeUnknown variant depends on call-site intent.
`effect/require-for-each-concurrency` is not autofixable because choosing `concurrency: 1`, an unbounded policy, inheritance, or a named project constant changes runtime behavior.
`effect/require-named-effect-fn` is not autofixable because the tracing name should encode project/domain intent.
`effect/require-tagged-effect-fail` is not autofixable because replacing a raw failure value requires choosing or defining the correct typed error.
`effect/schema-type-adjacent` is not autofixable yet because moving separated type aliases can reorder module-level declarations.
`effect/use-root-imports` is not autofixable yet because safely rewriting imports requires merging with existing root imports and preserving local specifiers.

## Silent-failure rules

These rules target code that compiles, type-checks, and fails silently at runtime. The plugin ships no preset: every rule is enabled individually. "Default" marks rules intended for a default Effect configuration; "opt-in" marks rules to enable deliberately.

| Rule                                     | Trigger                                                                                                                                                                                                                                                                                                            | Status                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effect/no-plain-yield`                  | `yield` without `*` inside an `Effect.gen`, `Effect.fn`, `Effect.fnUntraced`, or `Effect.fnUntracedEager` generator. Autofix inserts `*`.                                                                                                                                                                          | Default                                                                                                                                             |
| `effect/matching-identifier`             | A class extending `Context.Service`, `Schema.Class`, `Schema.Error`, `Schema.TaggedClass`, `Schema.TaggedError`, `Data.TaggedClass`, or `Data.TaggedError` whose string key/tag (last path segment for keys and identifiers) or `Self` type argument names another class. Options: `ignore`, `stripSuffixes`.      | Default                                                                                                                                             |
| `effect/effect-fn-name-matches-binding`  | `const create = Effect.fn("Repo.getById")(...)`: the last dot-segment of the span name differs from the variable, property, or class field it is bound to. Inline and dynamically named calls are skipped. Option: `ignorePattern`.                                                                                | Default                                                                                                                                             |
| `effect/preserve-thrown-cause`           | An `Effect.try` / `Effect.tryPromise` `catch` mapper with no parameter or a parameter it never reads.                                                                                                                                                                                                              | Default                                                                                                                                             |
| `effect/no-swallowed-failure`            | `Effect.ignore` without a `log` option, or an `Effect.catch` handler that ignores the error and returns `Effect.void`, `Effect.succeedNone`, or `Effect.succeed(<literal, undefined, [], {}>)`. `catchTag`/`catchIf` are exempt; bare `ignore` inside finalizers is allowed unless `allowInFinalizers` is `false`. | Default                                                                                                                                             |
| `effect/no-effect-promise`               | Any `Effect.promise` call whose thunk is not syntactically total (`Promise.resolve`, `scheduler.*`, resolve-only `new Promise`). Options: `allow` globs, `mode: "rejectable-only"` to report only thunks with a visible `fetch`, body reader, dynamic `import()`, or member call.                                  | Default                                                                                                                                             |
| `effect/prefer-effect-fn`                | A named function with parameters whose whole body returns `Effect.gen(...)` (optionally piped). Generic functions, class methods, inline callbacks, zero-parameter thunks, and generators using `this` are skipped.                                                                                                | Default                                                                                                                                             |
| `effect/require-redacted-secret-config`  | `Config.String` / `Config.NonEmptyString` with a literal key that looks like a secret (`SECRET`, `PASSWORD`, `TOKEN`, `API_KEY`, `DATABASE_URL`, `_DSN`, ...) and does not end in a metadata suffix such as `_TTL` or `_HEADER_NAME`. Options: `secretPattern`, `benignPattern`.                                   | Default                                                                                                                                             |
| `effect/no-fork-detach`                  | `Effect.forkDetach` outside `allow` globs, and `Effect.forkChild` directly inside a `Layer.effect` / `effectDiscard` / `effectContext` / `unwrap` constructor unless the constructor observes the fiber with `Fiber.join` or `Fiber.await`.                                                                        | Default                                                                                                                                             |
| `effect/require-abort-signal`            | An `Effect.tryPromise` / `Effect.promise` thunk with no parameters that calls `fetch` (or a configured `abortableCalls` entry) without a `signal` option.                                                                                                                                                          | Default                                                                                                                                             |
| `effect/require-return-on-failure-yield` | A `yield*` statement of `Effect.fail*`, `Effect.die`, `Effect.interrupt`, `Effect.never`, or a yieldable error instance without `return`. Autofix prepends `return`.                                                                                                                                               | Opt-in (MAYBE): duplicates an error-level `@effect/language-service` diagnostic; enable at `warn` or skip when the language-service CLI runs in CI. |
| `effect/prefer-it-effect`                | `Effect.runPromise`, `runPromiseExit`, `runSync`, or `runSyncExit` inside a plain `it` / `test` callback in a test file. Hooks, `it.effect`, `it.live`, `it.scoped`, `it.layer`, and `runtime.runPromise` are not matched. Option: `testFiles`.                                                                    | Opt-in: requires `@effect/vitest`; keep out of default presets.                                                                                     |
| `effect/prefer-run-main`                 | A module top-level `Effect.runPromise`, `runPromiseExit`, or `runFork` statement, including `void`, `await`, promise chains, and `.pipe(..., Effect.runPromise)`. Tests and `scripts/` are allowed by default; configure `allow` for serverless and edge entry files.                                              | Opt-in (MAYBE): platforms without a `runMain` need allow globs.                                                                                     |
| `effect/no-effect-type-assertion`        | `as` or angle-bracket assertions to `Effect.Effect`, `Layer.Layer`, or `Stream.Stream` with two or more type arguments.                                                                                                                                                                                            | Opt-in (MAYBE): overlaps with assertion-justification rules and cannot tell widening apart.                                                         |
| `effect/bounded-retry`                   | `Effect.retry` with a policy built in the same file only from `Schedule.exponential`, `spaced`, `fixed`, `fibonacci`, `windowed`, or `forever` and no `recurs`, `upTo`, `during`, `while`, `times`, or `until`. Imported schedules and `Effect.repeat` are skipped.                                                | Opt-in (MAYBE): under-reports whenever schedules live in another module.                                                                            |

Concept credits for these rules: `@effect/language-service` diagnostics (`missingStarInYieldEffectGen`, `missingReturnYieldStar`, `classSelfMismatch`, `deterministicKeys`, `effectFnOpportunity`, `unsafeEffectTypeAssertion`) and the `AGENTS.md` and `ai-docs` bundled with the `effect` package (span naming, service keys, `return yield*`, cause-preserving catch mappers, bounded retry schedules). All rules are independent re-implementations.

## Deferred rules

A rule flagging `Schema.decodeUnknown*` applied to inputs that are already typed (STEER-049) requires type information and is deferred until oxlint's JS plugin API supports type-aware rules.

## Contract boundaries and migration

Compatibility is exercised against Effect `4.0.0-rc.115`; this is not a promise that every Effect 3/4 spelling is interchangeable. Error-channel/mapper checks use AST type nodes and cycle-safe aliases. Named curried `Effect.fn` bodies, imported Effect aliases in the updated call recognizers, data-last `forEach`, logging effects, and discarded pipelines are covered.

`dependencies-first`, service ownership, root imports, array helpers, no-switch, and prefer-match are architectural preferences. Concurrency rules require an explicit choice; omitted concurrency is not necessarily unbounded. Formatting does not belong to dependencies-first. `serviceTypeNames` identifies additional owned service parameter contracts; constructor imports use service module paths or configured `serviceModules`, not a generic `make` prefix alone. Static forwarders require a `.Service`/`["Service"]` parameter projection.

Runtime rules share boundary matching: `no-run-promise-in-runtime` owns runPromise/runPromiseExit; `no-unscoped-runtime-launch` owns fork/sync/callback/Layer launches. Configure the same `allow` paths for both. Try-promise catch policy asks for an explicit domain mapper; Effect 4's default is a generic wrapper, not an untyped TypeScript channel. Tagged-fail inspection rejects visible untagged literals, local const equivalents, and generic Error constructors; opaque imported values still require compiler/domain review.

Call recognizers resolve the `effect` import instead of matching the literal `Effect.` text: aliased and namespace imports are covered, and a local `const Effect = {...}` shadow is not. Runtime rules cover the `run*With` runners (`runPromiseWith`, `runPromiseExitWith`, `runForkWith`, `runSyncWith`, `runSyncExitWith`, `runCallbackWith`) and point-free references such as `program.pipe(Effect.runPromise)`. `no-floating-effect` reports discarded curried Effect calls such as `Effect.provideService(Tag, value)(program);`. `no-untyped-try-promise-catch` covers `Effect.try` in both overloads. `require-tagged-effect-fail` covers `Effect.failSync`, every native Error constructor, and same-file `class X extends Error` without `_tag`. `no-effect-ordie` also reports `Layer.orDie` and `Effect.catch` handlers whose whole body is `Effect.die`; the matching `allowedCalls` values are `"Layer.orDie"` and `"catchDie"`. `no-catch-all-cause` also reports `catchCauseIf`, `catchCauseFilter`, `sandbox`, and `Layer.catchCause`; `matchCause` and `matchCauseEffect` stay out of scope as terminal folds at the edge. `no-ambient-nondeterminism` includes `performance.now()`.

`no-unsafe-effect-body` and `dependencies-first` treat `Effect.fnUntraced` and `Effect.fnUntracedEager` bodies as Effect bodies. `no-unsafe-effect-body` also reports a `try` block that contains `yield*` (neither `catch` nor `finally` observes an Effect failure) and `setTimeout`/`setInterval`/`setImmediate` inside an Effect body; the `Effect.callback` register function is exempt. Concept credit: `@effect/language-service` diagnostics for try/catch in generators and global timers; independent re-implementation.

Raw JSON decoder exceptions require recognizable Schema decoding (including the `decodeUnknownEffect`, `decodeUnknownExit`, `decodeUnknownResult`, and `decodeUnknownPromise` spellings), not a Decoder-suffixed name. A schema decoder around JSON.parse validates the decoded value but does not catch JSON syntax exceptions; prefer the Schema JSON-string pipeline at owned boundaries. Crypto injection must preserve cryptographic security. Array-helper preference applies only when array evidence is visible; it is not a performance claim.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                         | Trigger or review scope                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bounded-retry`                    | Require Effect.retry policies visible in the same file to carry a bound such as Schedule.recurs, Schedule.upTo, Schedule.during, times, while, or until.                |
| `dependencies-first`               | Yield service dependencies before runtime logic in Effect bodies.                                                                                                       |
| `effect-fn-name-matches-binding`   | Require the last dot-segment of an Effect.fn span name to equal the variable or property the function is bound to.                                                      |
| `matching-identifier`              | Require Context.Service keys, Schema class identifiers, tagged error tags, and Self type arguments to name the class that declares them.                                |
| `no-ambient-nondeterminism`        | Disallow ambient time, randomness, and crypto reads in Effect code.                                                                                                     |
| `no-cascading-layer-provide`       | Disallow cascading Layer.provide steps within a single pipe.                                                                                                            |
| `no-catch-all-cause`               | Disallow Effect.catchCause, catchCauseIf, catchCauseFilter, sandbox, Layer.catchCause, and Effect 3 catchAllCause because they catch defects.                           |
| `no-effect-ordie`                  | Disallow Effect.orDie, Effect.orDieWith, Layer.orDie, and Effect.catch handlers that only die outside configured escape hatches.                                        |
| `no-effect-promise`                | Disallow Effect.promise outside configured files unless the thunk is a syntactically total promise such as Promise.resolve or a resolve-only timer.                     |
| `no-effect-type-assertion`         | Disallow `as` and angle-bracket assertions to Effect.Effect, Layer.Layer, or Stream.Stream types that spell out error or requirement channels.                          |
| `no-floating-effect`               | Disallow standalone Effect values that are created and ignored.                                                                                                         |
| `no-fork-detach`                   | Disallow Effect.forkDetach outside configured files and Effect.forkChild directly inside Layer constructors, where Effect.forkScoped ties the fiber to the layer scope. |
| `no-nested-layer-provide`          | Disallow Layer.provide calls nested inside another Layer.provide call.                                                                                                  |
| `no-plain-yield`                   | Disallow yield without * inside Effect.gen, Effect.fn, and Effect.fnUntraced generators.                                                                                |
| `no-raw-json-parse`                | Require Effect Schema decoding for JSON.parse results.                                                                                                                  |
| `no-raw-json-stringify`            | Require Effect Schema encoding instead of raw JSON.stringify.                                                                                                           |
| `no-run-promise-in-runtime`        | Disallow Effect.runPromise, runPromiseExit, and their run*With variants outside configured runtime boundaries.                                                          |
| `no-schema-any`                    | Disallow Schema.Any outside configured escape-hatch files.                                                                                                              |
| `no-service-constructor-imports`   | Disallow make-prefixed imports from project service directories into runtime code.                                                                                      |
| `no-service-dependency-parameters` | Disallow service projection types and configured service names in parameters.                                                                                           |
| `no-service-option`                | Disallow Effect.serviceOption in favor of required services provided by layers.                                                                                         |
| `no-static-service-forwarders`     | Disallow static class properties that only forward to an Effect service method.                                                                                         |
| `no-swallowed-failure`             | Disallow Effect.ignore without a log option and Effect.catch handlers that discard the error and succeed with a placeholder.                                            |
| `no-switch`                        | Disallow switch statements in Effect code in favor of Match.                                                                                                            |
| `no-unsafe-effect-body`            | Disallow throw, await, try blocks around yield*, and global timers inside Effect.gen, Effect.fn, and Effect.fnUntraced bodies.                                          |
| `no-unsafe-error-channel`          | Disallow unknown and any as the Effect error channel.                                                                                                                   |
| `no-unsafe-error-mapper`           | Disallow unknown and any in Effect error mapper parameters.                                                                                                             |
| `no-unscoped-runtime-launch`       | Disallow Effect.runFork, runSync, runSyncExit, runCallback, their run*With variants, and Layer.launch outside configured runtime boundaries.                            |
| `no-untyped-try-promise-catch`     | Require Effect.try and Effect.tryPromise to map thrown or rejected values with a catch handler.                                                                         |
| `prefer-effect-array-helpers`      | Prefer Effect array helpers over native array helper methods.                                                                                                           |
| `prefer-effect-fn`                 | Prefer Effect.fn over functions with parameters whose entire body returns Effect.gen, optionally piped.                                                                 |
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
| `require-return-on-failure-yield`  | Require `return yield*` when an Effect generator statement yields Effect.fail, Effect.die, Effect.interrupt, Effect.never, or a yieldable error instance.               |
| `require-tagged-effect-fail`       | Require tagged error values for Effect.fail and Effect.failSync, rejecting literals, native Errors, and same-file untagged Error subclasses.                            |
| `schema-type-adjacent`             | Keep a Schema's matching type alias adjacent, allowing whitespace and JSDoc.                                                                                            |
| `use-root-imports`                 | Require root imports for stable Effect modules.                                                                                                                         |

### Credited concepts

- @effect/language-service classSelfMismatch and deterministicKeys diagnostics (concept)
- @effect/language-service diagnostics tryCatchInEffectGen and globalTimersInEffect (concept)
- @effect/language-service effectFnOpportunity diagnostic (concept)
- @effect/language-service missingReturnYieldStar diagnostic (concept)
- @effect/language-service missingStarInYieldEffectGen diagnostic (concept)
- @effect/language-service unsafeEffectTypeAssertion diagnostic (concept)
- Effect bundled AGENTS.md "Always return when raising an error" (concept)
- Effect bundled AGENTS.md "Avoid creating functions that only wrap and return an Effect.gen" (concept)
- Effect bundled AGENTS.md "The name string should match the function name" (concept)
- Effect bundled AGENTS.md service-key and error-tag convention (concept)
- Effect bundled ai-docs "capped exponential backoff with jitter and max attempts" pattern (concept)
- Effect bundled ai-docs `catch: (cause) => new X({ cause })` convention (concept)
- ai-automation by Sandro Maglione (inspiration, independently re-implemented)
- anti-slop by Dillon Mulroy (MIT, concept re-implemented)

<!-- harness-catalog:end -->
