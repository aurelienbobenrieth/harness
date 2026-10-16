# Test strategies

Load when picking a test strategy. Rows are common fits, not the only ones; each strategy past examples needs a reason the example tests can't cover.

## Failure → strategy

| Failure you fear                                 | Strategy                                                              | Signals                                                |
| ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| wrong output for known cases                     | hand-picked examples, boundary values                                 | `no-weak-test-assertions`                              |
| a law broken on inputs nobody listed             | bounded property; keep seed and shrink path                           | `property-test-opportunity`                            |
| bad sequences: retry, cancel, duplicates         | state model simpler than the code                                     | `temporal-coupling`                                    |
| a fake drifting from the real boundary           | one contract suite run against fake and real                          | `fake-parity`, `integration-test-owns-its-boundary`    |
| silent wrong data, not a crash                   | exact values and absences, never "doesn't throw"                      | `pinned-suspect-output`                                |
| green tests that check nothing                   | scoped mutation run, survivors classified                             | `test-behavior-coverage`                               |
| broken install or public import                  | packed artifact in a clean consumer                                   | none                                                   |
| flaky timing, ambient state                      | controlled clock, randomness, IDs, ordering                           | `no-ambient-nondeterminism-in-tests`, `no-test-sleeps` |
| a race between concurrent operations             | controlled, replayable interleavings at the real boundary             | none                                                   |
| step 2 of 3 fails and leaves half-written state  | fault injected at the boundary, state asserted after                  | `no-swallowed-failure` (effect)                        |
| data written by the last release no longer reads | fixtures in the old format, migration run on them                     | `persisted-snapshot-compat` (xstate)                   |
| a wrong role or tenant gets through              | negative cases: wrong role, other tenant, expired session             | none                                                   |
| a refactor breaks tests while behavior holds     | assert observable behavior; snapshots only for stable rendered output | `test-behavior-coverage`                               |
| a test passes only after another one ran         | each test builds its own state; run in random order once              | none                                                   |

## Properties

- For real laws: normalization is idempotent, totals are preserved, ordering holds, bounds hold, a lossless round trip returns the input. Define the valid domain and the relation before the generator.
- Round trips can pass with encoder and decoder sharing one mistake; pair them with a few known encodings. Lossy transforms have no round trip.
- Traps: heavy filtering, generators that never reach the risky region, an oracle that reimplements the algorithm.
- Build generated values through the domain's constructors, and keep the generator next to that domain module.
- Keep the seed and shrink path; turn a found failure into a named example.

## State models

- For sequences: retry after partial completion, cancel then resume, duplicate events, ownership changes.
- The model is simpler than the implementation and asserts observable state after each command. A few independent branches don't need one.
- A sequential model doesn't prove races. Ordering risk → controlled interleavings or the real concurrency boundary, bounded and replayable.

## Contracts

- List the fake's assumptions. Run one shared suite against the fake and against a disposable real instance, authoritative fixture, or authorized sandbox. Label what the real side proves.
- Published package: pack it, install it in a clean consumer, import only public entry points. Workspace resolution hides install defects.

## Mutation

- Scope to changed logic or a suspiciously green suite; never chase a repo-wide score.
- Classify each survivor before touching tests: missing behavior, weak assertion, unreachable code, equivalent mutant, or test-selection gap.
- The score is a diagnostic, not proof the product works.
