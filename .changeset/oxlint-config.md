---
"@aurelienbbn/oxlint-config": patch
---

The strict preset settles three rules for every TypeScript project instead of only under the Effect layer: `eslint/new-cap` ignores PascalCase factory calls (`capIsNew: false`), `eslint/no-redeclare` is off (a value and its type share a name; the compiler rejects real redeclarations), and both leave `effectIdiomRules`. `eslint/no-void` allows the statement form, the one `typescript/no-floating-promises` asks for. `typescript/explicit-module-boundary-types` is off: `explicit-function-return-type` reports the same functions and `noImplicitAny` owns argument types. `unicorn/number-literal-case` is off: oxfmt writes lowercase hex digits, which the rule reports. `eslint/func-style` allows function declarations and arrow functions (function expressions still report), and `eslint/max-lines` is off: file length is not a design signal.
The `@effect/tsgo` layer no longer turns `effecttsgo/catch-to-or-else-succeed` off: `effect/no-swallowed-failure` now accepts `Effect.orElseSucceed`, so the rewrite no longer conflicts.
