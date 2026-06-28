# @aurelienbbn/oxlint-plugin-effect

Custom oxlint rules for projects that use Effect.

## Rules

- `effect/dependencies-first`: require top-level Effect service dependency yields to appear before runtime logic with one blank line between the dependency block and logic.
- `effect/no-catch-all-cause`: require expected error handlers instead of `Effect.catchAllCause`, which also catches defects.
- `effect/no-effect-ordie`: require typed failures instead of converting failures to defects with `Effect.orDie` or `Effect.orDieWith` outside configured escape hatches.
- `effect/no-raw-json-parse`: require JSON strings to be parsed through Effect Schema decoding.
- `effect/no-run-promise-in-runtime`: require `Effect.runPromise` to stay inside configured runtime boundary files.
- `effect/no-schema-any`: require concrete schemas or `Schema.Unknown` instead of `Schema.Any` outside configured escape-hatch files.
- `effect/no-service-dependency-parameters`: require Effect services to be yielded from context instead of passed as parameters.
- `effect/no-raw-json-stringify`: require JSON output to be emitted through Effect Schema encoding.
- `effect/no-unsafe-error-channel`: require `Effect.Effect` error channels to use `never` or typed errors instead of `unknown` or `any`.
- `effect/no-unsafe-effect-body`: require `Effect.gen` and `Effect.fn` bodies to use Effect error/promise constructors instead of raw `throw` or `await`.
- `effect/no-unsafe-error-mapper`: require Effect error handlers and mappers to receive typed errors instead of `unknown` or `any`.
- `effect/no-unscoped-runtime-launch`: require Effect and Layer launch calls to stay inside configured runtime boundary files.
- `effect/prefer-effect-array-helpers`: prefer Effect collection helpers over native array helper methods in runtime code.
- `effect/prefer-schema-decode-unknown`: require Schema `decodeUnknown` variants when decoding JSON-parsed or unknown-cast boundary values.
- `effect/require-for-each-concurrency`: require `Effect.forEach` calls to declare an explicit concurrency option.
- `effect/require-named-effect-fn`: require `Effect.fn` calls to include a non-empty tracing name.
- `effect/require-tagged-effect-fail`: require `Effect.fail` calls to receive typed error values instead of raw literals or objects.
- `effect/schema-type-adjacent`: require Effect Schema type aliases to be placed immediately after their schema declarations.
- `effect/use-root-imports`: require stable Effect modules to be imported from `"effect"` instead of stable `effect/*` subpaths.

## Autofix

`effect/dependencies-first` is not autofixable because moving dependency yields can change when Effects are constructed or executed.
`effect/no-catch-all-cause` is not autofixable because replacing it requires choosing the intended expected-error handler and defect policy.

`effect/no-effect-ordie` is not autofixable because replacing defect conversion requires choosing the intended typed failure or explicit defect boundary.
`effect/no-unsafe-error-channel` is not autofixable because replacing `unknown` or `any` requires choosing a typed domain/infra error or confirming the Effect is truly infallible.
`effect/no-unsafe-effect-body` is not autofixable because replacing `throw` or `await` requires choosing the correct typed failure, defect, or promise adapter.
`effect/no-unsafe-error-mapper` is not autofixable because replacing broad error parameters requires choosing a typed failure union or explicit boundary helper.
`effect/no-unscoped-runtime-launch` is not autofixable because moving runtime launch calls requires choosing the application boundary.
`effect/prefer-effect-array-helpers` is not autofixable because the right Effect helper and concurrency/error behavior depends on intent.
`effect/prefer-schema-decode-unknown` is not autofixable because choosing the exact sync/effect/either/promise decodeUnknown variant depends on call-site intent.
`effect/require-for-each-concurrency` is not autofixable because choosing `concurrency: 1`, an unbounded policy, inheritance, or a named project constant changes runtime behavior.
`effect/require-named-effect-fn` is not autofixable because the tracing name should encode project/domain intent.
`effect/require-tagged-effect-fail` is not autofixable because replacing a raw failure value requires choosing or defining the correct typed error.
`effect/schema-type-adjacent` is not autofixable yet because moving separated type aliases can reorder module-level declarations.
`effect/use-root-imports` is not autofixable yet because safely rewriting imports requires merging with existing root imports and preserving local specifiers.
