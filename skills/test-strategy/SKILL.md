---
name: test-strategy
description: Audit a suite's blind spots and choose among property, state-model, contract, or mutation testing. Use when ordinary examples leave uncertain invariants or boundary behavior; routine test edits belong to testing.
---

# Test Strategy

Start from a consequential failure that existing tests might miss. Read [testing](../testing/SKILL.md) for assertion quality and reproducibility. Add a stronger test technique only when it supplies evidence the current suite lacks.

## Properties

Use a property for a real law over an input domain: stable normalization, preserved totals, ordering, bounds, or a lossless round trip. Define the valid domain and the observable relation before choosing a generator. Lossy transforms cannot promise exact round trips, and successful round trips alone can miss two components making the same mistake.

Generate inputs that reach the risky behavior. Excessive filtering, tiny trivial values, and equality with a reimplementation of the algorithm create misleading confidence. Keep concrete boundary examples when they explain the contract or pin an escaped defect; a property need not replace every example it overlaps.

Use the project's installed library APIs and reproducible seed and shrink-path reporting. Keep a stable local run when useful and add bounded exploratory runs when warranted. Avoid embedding version-specific framework recipes in a generic strategy.

## State models

Use a small reference model when correctness depends on sequences: retry after partial completion, cancel then resume, duplicate events, or concurrent ownership changes. The model should encode the contract more simply than the implementation. Check observable results after meaningful transitions.

A sequential model does not prove race behavior. If ordering or scheduling is the risk, exercise controlled interleavings or the real concurrency boundary, with bounded runs and replayable failures. Do not introduce model-based tooling for a handful of independent branches.

## Contracts

List the assumptions a fake makes about the real boundary. Share expectations between fake and real implementations where their semantics actually match. Run the real side against a disposable local service, authoritative fixture, or authorized sandbox as appropriate; label exactly which assumptions that choice can prove.

For a published package, test the packed artifact through a clean consumer install and public imports. Workspace source resolution, injected dependencies, and local overrides can mask installation defects. Keep those accommodations visible in the evidence and test normal installation separately when making that claim.

## Mutation audits

Use a scoped mutation run when suspiciously green tests, weak assertions, or important legacy behavior leave uncertainty. Inspect meaningful changed logic first instead of starting with a repository-wide score target.

A surviving mutant may expose missing behavior, an inadequate assertion, unreachable code, an equivalent transformation, or a test-selection problem. Classify it before changing the suite. Timeouts and compilation failures need their own interpretation. A score is a diagnostic measure, not proof that the product works.

## Outcome

Return the uncovered contract, the selected proof and why it reaches the failure, and the observed result if executed. Separate a proposed experiment from a completed run. Retain existing useful tests unless the replacement demonstrably preserves their failure detection. Avoid new dependencies when the current tools can establish the same claim.
