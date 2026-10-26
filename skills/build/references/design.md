# Design rules

Load before shaping a module, export, stored shape, or package boundary. Backing lint per rule (domain when not core); no lint = judgment only.

| Rule                                                                                       | Backed by                                                              |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Two behaviors: two functions, not a flag                                                   | `flag-forked-function`                                                 |
| States as a discriminated union, not correlated optionals                                  | `correlated-optional-state`                                            |
| Parse at boundary into a type carrying the proof                                           | `validation-discards-proof`, `fallback-masks-failure`                  |
| Decisions pure; I/O in a thin shell; test core with values                                 | `no-vitest-mocking`, `no-test-logic-in-production`                     |
| Dependencies inward: core never imports adapters, tests, mutable shared state              | `no-mutable-exported-state`, `no-vitest-in-source`                     |
| One public surface per package (`exports`); no deep imports                                | `workspace-boundaries`, packed consumer install                        |
| Expected failures: typed values in the contract; defects throw, never caught to keep going | `no-discarded-caught-error`, `no-swallowed-failure` (effect)           |
| One source of truth: never store derivable state; compute where read                       | `derived-boolean-context` (xstate)                                     |
| Retry-replayable write: idempotency key; second call changes nothing                       | `require-idempotent-mutations` (shopify-app), `bounded-retry` (effect) |
| Public surface: add-then-remove (new beside old, deprecation, major changeset)             | packed consumer install                                                |
| Persisted/wire shape readable by previous release, or ships its migration                  | `persisted-snapshot-compat` (xstate)                                   |

Costly public interface: sketch two genuinely different shapes first. Never for internals.
