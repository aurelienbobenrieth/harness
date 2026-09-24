---
name: testing
description: Choose and write tests that fail for the right reason, with oracles independent of the code under test. Use when adding, changing, or reviewing tests, picking a test strategy (example, property, state model, contract, mutation), or judging whether a green suite proves a claim. Not for choosing what to build (see build).
---

# Testing

**A test earns its place by catching a named defect with an oracle the implementation didn't produce.**

## Oracles

- Expected values come from the spec, a hand-worked example, a reference, or a law. Never from running the code, calling the subject's own helpers, or recomputing with its algorithm (`expected-value-recomputed`).
- Write the expectation from the requirement before reading the implementation; reading buggy code first makes you assert the bug.
- Never mock the subject (`no-stubbed-subject`). A test that imports nothing from the project tests nothing (`test-exercises-project-code`).
- `toBeDefined`, `toBeTruthy`, bare `toHaveBeenCalled` prove almost nothing (`no-weak-test-assertions`). Exact values for closed data; targeted fields for extensible records and UI; assert absence (extra writes, events, fields) when that's the failure.
- Observable results over call order, unless a boundary call's payload and count are the contract.

## Pick strategies by the failure you fear

Most changes need more than one row. A smoke test alone only proves it runs once, somewhere.

| Failure you fear                         | Strategy                                         | Signals                                                |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| wrong output for known cases             | hand-picked examples, boundary values            | `no-weak-test-assertions`                              |
| a law broken on inputs nobody listed     | bounded property; keep seed and shrink path      | `property-test-opportunity`                            |
| bad sequences: retry, cancel, duplicates | state model simpler than the code                | `temporal-coupling`                                    |
| a fake drifting from the real boundary   | one contract suite run against fake and real     | `fake-parity`, `integration-test-owns-its-boundary`    |
| silent wrong data, not a crash           | exact values and absences, never "doesn't throw" | `pinned-suspect-output`                                |
| green tests that check nothing           | scoped mutation run, survivors classified        | `test-behavior-coverage`                               |
| broken install or public import          | packed artifact in a clean consumer              | —                                                      |
| flaky timing, ambient state              | controlled clock, randomness, IDs, ordering      | `no-ambient-nondeterminism-in-tests`, `no-test-sleeps` |

Properties, state models, contracts, mutation: read [strategies](references/strategies.md) before writing one.

**Pick the double by dependency:** in-process → use the real thing · local stand-in exists (SQLite, temp dir, in-memory broker) → use it · remote you own → contract test · true external → fake at your adapter plus a contract. Captured responses test parsing, never live auth, pagination, or timing.

## Red, green, keep honest

- Red must fail on the assertion, not on an import, fixture, or type error.
- While making it green, tests are read-only. Spec and test disagree → stop and report; never edit either to force agreement (`test-expectation-drift` flags loosened, skipped, or re-valued expectations for a human).
- Doubt a green test → break the code (revert the fix, flip a condition). Still green = tautology.
- Deepened or replaced a module → delete the old tests that pinned its internals; don't layer new tests over them.

## Determinism and claims

- Unit: control clocks, randomness, IDs, ordering; restore globals and dispose resources on failure; isolated temp dirs, no fixed ports.
- Integration: explicit environment, finite timeouts, isolated data, cleanup, outside the fast loop. Real clocks and networks are fine there when they're what's verified.
- Report zero selected tests, skips, and retries apart from passes. Retries don't fix flakes. Coverage finds gaps; it proves nothing.
- Before deleting a test, name what still catches its failure. Don't rewrite a working suite for style.
- Rule or validator: firing cases and nearby silent cases. Autofix: exact rewrite, ambiguous input untouched.

```ts
/**
 * @attribution https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/tdd (MIT; inspiration: vertical red-green slices, mocking only at boundaries)
 * @attribution https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/codebase-design (MIT; inspiration: dependency categories choose the double, replace rather than layer tests)
 * @attribution https://arxiv.org/abs/2410.21136 (paper; inspiration: LLM oracles capture actual rather than expected behavior)
 * @attribution https://arxiv.org/abs/2510.20270 (paper; inspiration: read-only tests and stop-on-conflict against test tampering)
 */
```
