---
"@aurelienbbn/oxlint-plugin-effect": minor
---

Adds two opt-in naming rules. `effect/schema-literal-case` keeps the string values of `Schema.Literals([...])` in one case (`case`: `"snake"` by default, or `"kebab"`, `"camel"`, `"pascal"`). `effect/telemetry-name-format` requires literal span names (`Effect.fn`, `withSpan` and the other span constructors) and `Rpc.make` tags in lowercase dotted snake_case with at least two segments (`orders.sync`), and log and span annotation keys in lowercase dotted snake_case (options `pattern`, `keyPattern`, `minSegments`). It conflicts with `effect/effect-fn-name-matches-binding`: enable one or the other. Neither rule autofixes.
