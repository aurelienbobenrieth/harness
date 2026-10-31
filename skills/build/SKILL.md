---
name: build
description: Implement an authorized feature, fix, or refactor with verifiable behavior and designs that stay deep, isolated, and small at their public surface. Use when changing code behavior, adding modules or exports, or reshaping boundaries. Not for explanation-only requests or unresolved requirements (see align).
---

# Build

**Smallest change that proves itself, in code that's easy to change next time.** A small edit stays a small edit.

## Before editing

- Inspect the working tree; existing work survives. Read the real validation commands and their side effects from config.
- "Can you fix this?" → act. Ask only for an outcome-changing decision or an action outside authorization; several open, interdependent decisions → [align](../align/SKILL.md) first.
- Unknown cause or unfamiliar boundary → a small probe before choosing the design.

## Outcome and evidence

- Establish trigger → expected outcome from the request or spec, with independent expected examples and a verifying command, per [testing](../testing/SKILL.md).
- Choose the implementation and test order for the task. TDD is an option, not a required sequence. Preserve the agreed behavior; a spec/test disagreement needs resolution, not weakened expectations to pass.
- Doubt a green test → break the code, it must fail for the intended reason. Pick extra strategies (property, state model, contract, packed install) by the failure you fear, not by habit.

Defect → reproduce the symptom at its boundary first, cheapest distinguishing observation first; no reproduction → name the missing condition and keep the cause provisional. Covered, low-impact, reversible edit → no new test, still the full gate.

## Design

A module hides one decision, its interface stays much smaller than what it hides, and dependencies point inward. Before shaping a module, an export, or a package boundary, load [design](references/design.md): each rule there names the lint that backs it.

## Implement and verify

- Runtime limits, retry identity, cancellation, partial failure: design them in when the workload needs them.
- Stale generated code → run the generator (check whether it syncs externally). Never hand-write or widen substitute types.
- Parallel workers: bounded scope, file ownership, a verification task each; trust their evidence, not their confidence. Serialize shared mutable state.
- In a worktree, servers take their ports from `worktree-hygiene ports` with a strict port; before handoff `worktree-hygiene done` exits 0 (`--reap` stops what you started). Never stop a process by name or port alone.
- Prove at the failure boundary: real filesystem for a writer, consumer install for exports, browser for focus. A fake, static render, or compile proves only itself.
- Skipped, empty, stale, or unavailable ≠ pass. Rerun checks a later change invalidated; full gate on the final state.
- Final diff: no debug output, temp files, formatter churn, or scope creep.

**Handoff:** resulting behavior, checks run and results, material limits; readable without earlier progress messages. Never "done" with a failing gate.
