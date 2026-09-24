---
name: test-strategy
description: Audit a suite's blind spots and choose property, state-model, contract, or mutation testing. Use when examples leave invariants or boundary behavior uncertain; routine test edits belong to testing.
---

# Test Strategy

Start from a consequential failure the suite might miss. Base rules: [testing](../testing/SKILL.md).

## Properties

- For real laws: normalization, preserved totals, ordering, bounds, lossless round trip. Define domain and relation first.
- Round trips can pass with encoder and decoder sharing one mistake; lossy transforms have none.
- Traps: heavy filtering, trivial values, oracle reimplementing the algorithm.
- Keep boundary examples that pin an escaped defect.

## State models

- For sequences: retry after partial completion, cancel/resume, duplicate events, ownership changes.
- Model simpler than the implementation. A few independent branches don't need one.
- Sequential models don't prove races → controlled interleavings or real concurrency, bounded and replayable.

## Contracts

- List the fake's assumptions; run shared expectations against a disposable service, authoritative fixture, or authorized sandbox. Label what that proves.
- Published package: packed artifact, clean consumer install, public imports. Workspace resolution masks install defects.

## Mutation audits

- Scope to suspicious green tests or changed logic, not a repo-wide score.
- Classify survivors first: missing behavior, weak assertion, unreachable code, equivalent mutant, selection problem.
- Score is diagnostic, not proof.

## Output

Uncovered contract, chosen proof, observed result. Mark proposals vs completed runs.
