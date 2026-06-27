# @aurelienbbn/oxlint-plugin-effect

Custom oxlint rules for projects that use Effect.

## Rules

- `effect/no-raw-json-parse`: require JSON strings to be parsed through Effect Schema decoding.
- `effect/no-raw-json-stringify`: require JSON output to be emitted through Effect Schema encoding.
- `effect/require-for-each-concurrency`: require `Effect.forEach` calls to declare an explicit concurrency option.

## Autofix

`effect/require-for-each-concurrency` is not autofixable because choosing `concurrency: 1`, an unbounded policy, inheritance, or a named project constant changes runtime behavior.
