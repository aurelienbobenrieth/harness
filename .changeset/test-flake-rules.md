---
"@aurelienbbn/oxlint-plugin-core": minor
---

Two new test rules. `no-test-flake-masking` reports retries (test and suite options, `vi.setConfig`, the Vitest config) and timeouts raised on one test, suite or hook; a suite-wide `testTimeout` in the config stays allowed. `no-unsignaled-test-poll` reports `expect.poll` and `vi.waitFor` that wait on a spy or a recorded collection's length instead of a signal. `no-test-sleeps` messages no longer send every sleep to `vi.waitFor` / `expect.poll`: they point at the operation or a signal first, and polling only for observable state.
