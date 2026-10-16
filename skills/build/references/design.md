# Design rules

Load before shaping a module, an export, a stored shape, or a package boundary. Each rule names the lint that backs it, with its domain when it isn't core; a rule with none is judgment only. These are the decisions that cost most to undo, not every good practice: a case they don't cover is yours to judge.

| Rule                                                                                                        | Backed by                                                              |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A module hides one decision; changing it touches one module                                                 | `change-scatter-review`, `hotspot-change-review`                       |
| Interface much smaller than what it hides; no pass-through wrappers                                         | `abstraction-earns-keep`, `no-reexport-only-modules`                   |
| Steps that must run in order sit behind one call                                                            | `temporal-coupling`                                                    |
| Two behaviors → two functions, not a flag                                                                   | `flag-forked-function`                                                 |
| States as a discriminated union, not correlated optionals                                                   | `correlated-optional-state`                                            |
| Parse at the boundary into a type that carries the proof                                                    | `validation-discards-proof`, `fallback-masks-failure`                  |
| Decisions in pure functions; I/O in a thin shell; test the core with values                                 | `no-vitest-mocking`, `no-test-logic-in-production`                     |
| Dependencies point inward: core never imports adapters, tests, or mutable shared state                      | `no-mutable-exported-state`, `no-vitest-in-source`                     |
| One declared public surface per package (`exports`); consumers never deep-import                            | `workspace-boundaries`, packed consumer install                        |
| Unit, test, and fixtures colocated; the folder deletes as a whole                                           | none                                                                   |
| Group by domain: errors live beside their schemas and API, not a file each; folder once big                 | none                                                                   |
| Duplicate until the third real use shows the shape; one adapter is hypothetical, two are real               | `single-use-extraction-review`, `isomorphic-mapping`                   |
| An abstraction growing per-caller branches → inline it back, re-extract                                     | `abstraction-earns-keep`                                               |
| Expected failures are typed values in the contract; defects throw and are never caught to keep going        | `no-discarded-caught-error`, `no-swallowed-failure` (effect)           |
| One source of truth: never store what derives from other state; compute it where it's read                  | `derived-boolean-context` (xstate)                                     |
| A write a retry can replay has an idempotency key; the second call changes nothing                          | `require-idempotent-mutations` (shopify-app), `bounded-retry` (effect) |
| A public surface evolves add-then-remove: new shape beside the old, deprecation, major changeset to drop it | packed consumer install                                                |
| A persisted or wire shape stays readable by the previous release, or ships with its migration               | `persisted-snapshot-compat` (xstate)                                   |

Costly public interface → sketch two genuinely different shapes before committing to one. Never for internals.
