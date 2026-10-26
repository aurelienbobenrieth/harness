---
name: testing
description: Choose and write tests that fail for the right reason, with oracles independent of the code under test. Use when adding, changing, or reviewing tests, picking a test strategy (example, property, state model, contract, mutation), or judging whether a green suite proves a claim. Not for choosing what to build (see build).
---

# Testing

A test earns its place by catching a named defect with an oracle the implementation didn't produce. Name it after that defect (`rejects an expired session`), not the function called. Test count is never a goal; a test whose failure another already catches gets deleted.

## Oracles

- Expected values from spec, hand-worked example, reference, or law, written before reading the implementation. Never from running the code, the subject's own helpers, or its algorithm (`expected-value-recomputed`). Never mock the subject (`no-stubbed-subject`); a test importing nothing from the project tests nothing (`test-exercises-project-code`).
- `toBeDefined`/`toBeTruthy`/bare `toHaveBeenCalled` prove almost nothing (`no-weak-test-assertions`). Exact values for closed data; targeted fields for extensible records/UI; assert absence (extra writes, events, fields) when that's the failure. Observable results over call order, unless a boundary call's payload/count is the contract.

## Strategies: menu, not checklist

Start from the failure feared; pick whatever catches it with an independent oracle (a lone smoke test proves only that code ran once): [strategies](references/strategies.md).

**Double by dependency:** in-process: real thing. Local stand-in (SQLite, temp dir, in-memory broker): use it. Remote you own: contract test. True external: fake at your adapter + contract.

## Red, green, keep honest

- Red fails on the assertion, not an import/fixture/type error. Green phase: tests read-only. Spec/test disagree: stop, report; never edit either to force agreement (`test-expectation-drift` flags loosened, skipped, re-valued expectations).
- Use the configured changed-production mutation gate, including existing suites of moved consumers.
- Module deepened/replaced: delete tests that pinned its internals; don't layer over them.

## Determinism and claims

- Unit: control clocks, randomness, IDs, ordering; restore globals, dispose on failure; isolated temp dirs, no fixed ports.
- Report zero-selected, skips, retries apart from passes. Retries don't fix flakes. Rule/validator: firing cases + nearby silent cases. Autofix: exact rewrite, ambiguous input untouched.

- `effect/prefer-it-effect`: run Effect test programs with `it.effect` from `@effect/vitest` instead of calling a runtime in plain `it`.
