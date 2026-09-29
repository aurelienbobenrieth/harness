---
"@aurelienbbn/oxlint-config": minor
---

`effectIdiomRules` (applied by `withEffectTsgoLayer`) now also settles three strict rules that misread idiomatic Effect code: `eslint/no-redeclare` and `unicorn/throw-new-error` are off (a Schema beside its same-named type, the `Schema.TaggedError<Self>()(…)` factory), and `typescript/prefer-readonly-parameter-types` treats methods as readonly, ignores inferred parameter types, and allows Effect's immutable types by name. Consumers that set these rules themselves can drop their overrides; nothing that passed before reports now.
