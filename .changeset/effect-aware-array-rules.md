---
"@aurelienbbn/oxlint-plugin-effect": minor
"@aurelienbbn/oxlint-config": minor
---

`@aurelienbbn/oxlint-plugin-effect` adds `effect/no-array-callback-reference` and `effect/no-array-for-each`: unicorn's array checks, re-implemented to skip calls on modules imported from Effect (`Option.some(value)`, `Option.filter`, `Effect.forEach`), which the unicorn rules take for arrays under namespace imports. `effect/Array` helpers, which pass the index like native methods, are still checked.

`@aurelienbbn/oxlint-config`: `effectIdiomRules` turns `unicorn/no-array-callback-reference` and `unicorn/no-array-for-each` off in favor of those rules (without the plugin, set them back in `rules`). `withImportGraphLayer` takes `{ entrypoints }`, package entry points exempt from `oxc/no-barrel-file`, which the import graph makes count modules.
