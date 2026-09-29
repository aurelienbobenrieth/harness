---
"@aurelienbbn/oxlint-plugin-effect": minor
"@aurelienbbn/oxlint-config": minor
---

`@aurelienbbn/oxlint-plugin-effect` adds `effect/no-array-method-this-argument` and `effect/no-array-sort`, completing the Effect-aware array checks: unicorn's versions report Effect's data-first helpers (`Arr.filter(xs, f)`, where `f` is taken for a `thisArg`) and `Arr.sort(order)`, which returns a new array. `@aurelienbbn/oxlint-config`'s `effectIdiomRules` turns the two unicorn rules off in favor of them.
