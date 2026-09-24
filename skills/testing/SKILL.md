---
name: testing
description: Write or review tests that catch real behavior failures with reproducible evidence. Use when editing tests, picking a regression seam, or judging whether assertions back a claim; suite audits and property/state/mutation choices belong to test-strategy.
---

# Testing

Each test must catch a named defect. Never derive the expected value with the implementation's algorithm.

## Boundary → evidence

| Failure source                        | Evidence                                   |
| ------------------------------------- | ------------------------------------------ |
| Local logic                           | Examples with independently chosen outputs |
| Law over many inputs                  | Bounded property, replayable failures      |
| Database, filesystem, loader, service | Contract or integration check              |
| User interaction                      | Rendered browser/component behavior        |
| Environment config                    | Smoke check of that environment            |

Audits, properties, state models, mutation → [test-strategy](../test-strategy/SKILL.md).

- Fakes prove behavior only under their assumptions. Verify key ones against the real boundary; record what stays unverified.
- Captured responses test parsing, not live auth, pagination, delivery, or timing.

## Assertions

- Exact equality for closed values; targeted assertions for extensible records and UI.
- Assert absence (extra data, writes, events) when that is the failure mode.
- Observable results over internal call order, unless a boundary call's payload and count are the contract.
- Rule/validator: firing cases AND nearby silent cases. Autofix: exact rewrite; valid/ambiguous input untouched.

## Determinism

- Unit: control clocks, randomness, IDs, ordering. Restore globals, dispose resources on failure. Isolated temp dirs; no fixed ports or paths.
- Integration: explicit environment, finite timeouts, isolated data, cleanup, outside the fast loop.
- Properties: keep seed and shrink path. Promote found defects to named regression cases.

## Evidence claims

- New regression test must fail for the intended reason, not a fixture error.
- Report zero selected tests, skips, and retries separately from passes. Retries don't fix flakes.
- Coverage locates gaps; it proves nothing.
- Type checks don't prove runtime data or published declarations.
- Before deleting a test, name what else still catches its failure. Don't rewrite a working suite for style.
- Covered low-impact reversible change → no new test; still run required checks.
