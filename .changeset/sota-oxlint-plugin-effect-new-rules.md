---
"@aurelienbbn/oxlint-plugin-effect": minor
---

Add 15 rules for Effect code that compiles and fails silently: no-plain-yield (autofix), matching-identifier, effect-fn-name-matches-binding, preserve-thrown-cause, no-swallowed-failure, no-effect-promise, prefer-effect-fn, require-redacted-secret-config, no-fork-detach (including forkChild inside Layer constructors), and require-abort-signal, plus the opt-in require-return-on-failure-yield (autofix), prefer-it-effect (requires @effect/vitest), prefer-run-main, no-effect-type-assertion, and bounded-retry. Every rule is registered individually; none is enabled implicitly, so existing configurations are unaffected. Namespace detection resolves `effect` named imports and `effect/<Module>` namespace aliases and ignores local shadows.
