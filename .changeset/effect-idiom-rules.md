---
"@aurelienbbn/oxlint-config": minor
---

`withEffectTsgoLayer` now applies `effectIdiomRules`: `@effect/tsgo` wins over `typescript/promise-function-async`, and `eslint/new-cap`, `eslint/func-names` and `node/no-sync` accept Effect constructors, `Effect.gen` generators and `Effect.runSync`.
