---
"@aurelienbbn/oxlint-plugin-core": minor
"@aurelienbbn/oxlint-plugin-effect": minor
---

`core/no-ambient-nondeterminism-in-tests` takes `allFiles: true` to check test doubles and in-memory hosts outside `*.test.*` files. New `effect/no-live-clock-in-tests` reports `Clock.Clock.defaultValue()` and `DateTime.nowUnsafe()`, which read the machine's clock past the TestClock that `it.effect` provides.
