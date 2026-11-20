---
"@aurelienbbn/oxlint-plugin-core": minor
---

`no-vitest-mocking` (and the other test rules) now resolve `vi`, `it`, `test` and `expect` imported from `vite-plus/test` and `@effect/vitest`, not only `vitest`; it used to stay silent in projects importing from those. New option `forbidStubs` also reports `vi.stubGlobal` and `vi.stubEnv` (default `false`). Projects on those imports may see new findings from `no-vitest-mocking`, `no-test-sleeps`, `no-weak-test-assertions` and `no-ambient-nondeterminism-in-tests`.
