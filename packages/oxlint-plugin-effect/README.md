# @aurelienbbn/oxlint-plugin-effect

Custom oxlint rules for projects that use Effect.

## Rules

- `effect/no-raw-json-parse`: require JSON strings to be parsed through Effect Schema decoding.
- `effect/no-raw-json-stringify`: require JSON output to be emitted through Effect Schema encoding.
- `effect/no-unsafe-error-channel`: require `Effect.Effect` error channels to use `never` or typed errors instead of `unknown` or `any`.
- `effect/no-unsafe-effect-body`: require `Effect.gen` and `Effect.fn` bodies to use Effect error/promise constructors instead of raw `throw` or `await`.
- `effect/require-for-each-concurrency`: require `Effect.forEach` calls to declare an explicit concurrency option.

## Autofix

`effect/no-unsafe-error-channel` is not autofixable because replacing `unknown` or `any` requires choosing a typed domain/infra error or confirming the Effect is truly infallible.
`effect/no-unsafe-effect-body` is not autofixable because replacing `throw` or `await` requires choosing the correct typed failure, defect, or promise adapter.
`effect/require-for-each-concurrency` is not autofixable because choosing `concurrency: 1`, an unbounded policy, inheritance, or a named project constant changes runtime behavior.
