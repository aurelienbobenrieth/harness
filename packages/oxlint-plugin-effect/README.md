# @aurelienbbn/oxlint-plugin-effect

Custom oxlint rules for projects that use Effect.

## Rules

- `effect/no-catch-all-cause`: require expected error handlers instead of `Effect.catchAllCause`, which also catches defects.
- `effect/no-raw-json-parse`: require JSON strings to be parsed through Effect Schema decoding.
- `effect/no-run-promise-in-runtime`: require `Effect.runPromise` to stay inside configured runtime boundary files.
- `effect/no-schema-any`: require concrete schemas or `Schema.Unknown` instead of `Schema.Any` outside configured escape-hatch files.
- `effect/no-raw-json-stringify`: require JSON output to be emitted through Effect Schema encoding.
- `effect/no-unsafe-error-channel`: require `Effect.Effect` error channels to use `never` or typed errors instead of `unknown` or `any`.
- `effect/no-unsafe-effect-body`: require `Effect.gen` and `Effect.fn` bodies to use Effect error/promise constructors instead of raw `throw` or `await`.
- `effect/no-unsafe-error-mapper`: require Effect error handlers and mappers to receive typed errors instead of `unknown` or `any`.
- `effect/prefer-effect-array-helpers`: prefer Effect collection helpers over native array helper methods in runtime code.
- `effect/require-for-each-concurrency`: require `Effect.forEach` calls to declare an explicit concurrency option.
- `effect/require-named-effect-fn`: require `Effect.fn` calls to include a non-empty tracing name.
- `effect/require-tagged-effect-fail`: require `Effect.fail` calls to receive typed error values instead of raw literals or objects.
- `effect/use-root-imports`: require stable Effect modules to be imported from `"effect"` instead of stable `effect/*` subpaths.

## Autofix

ffect/no-catch-all-cause is not autofixable because replacing it requires choosing the intended expected-error handler and defect policy.

`effect/no-unsafe-error-channel` is not autofixable because replacing `unknown` or `any` requires choosing a typed domain/infra error or confirming the Effect is truly infallible.
`effect/no-unsafe-effect-body` is not autofixable because replacing `throw` or `await` requires choosing the correct typed failure, defect, or promise adapter.
`effect/no-unsafe-error-mapper` is not autofixable because replacing broad error parameters requires choosing a typed failure union or explicit boundary helper.
`effect/prefer-effect-array-helpers` is not autofixable because the right Effect helper and concurrency/error behavior depends on intent.
`effect/require-for-each-concurrency` is not autofixable because choosing `concurrency: 1`, an unbounded policy, inheritance, or a named project constant changes runtime behavior.
`effect/require-named-effect-fn` is not autofixable because the tracing name should encode project/domain intent.
`effect/require-tagged-effect-fail` is not autofixable because replacing a raw failure value requires choosing or defining the correct typed error.
`effect/use-root-imports` is not autofixable yet because safely rewriting imports requires merging with existing root imports and preserving local specifiers.
