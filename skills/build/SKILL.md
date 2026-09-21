---
name: build
description: Carry an authorized feature, fix, or refactor from code inspection through implementation and evidence. Use when changing repository behavior or coordinating several implementation steps; explanation-only requests do not need this workflow.
---

# Build

Finish the requested change with evidence for its actual failure modes. Match the process to the uncertainty; a small edit should remain a small edit.

## Establish the contract

Read the applicable repository instructions, affected code, existing tests, and relevant domain decisions. Inspect the working tree before editing so existing work survives. Discover the project's real validation commands and their side effects from configuration; names such as `check` or `dev` are not guarantees.

Treat requests such as "can you fix this?" as requests to act. Honor existing authorization and user constraints throughout the task. Ask only for a missing decision that materially changes the outcome or an action outside that authorization. Higher stakes justify more inspection and stronger proof; they do not automatically require another approval round.

Choose the amount of planning that resolves the uncertainty:

| Situation                            | Useful next step                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Clear, local change                  | Implement and verify directly.                                                    |
| Several interacting behaviors        | Record the affected contracts and how each will be checked.                       |
| Unknown cause or unfamiliar boundary | Run a small reproduction or probe before choosing the design.                     |
| Missing business decision            | Explain the consequence, ask one focused question, and continue independent work. |

For a substantial change, a compact table of trigger, expected outcome, and proof can carry the contract. Keep it with the work only when it helps implementation or review. Do not manufacture a specification document or test for every edit.

## Implement and diagnose

For a defect, reproduce the reported symptom at the relevant boundary. Use a falsifiable hypothesis and the cheapest observation that distinguishes it. When reproduction is unavailable, name the missing condition and keep any proposed cause provisional.

Prefer a regression test that fails for the reported defect before fixing it. For other changes, choose test order for useful feedback. Read [testing](../testing/SKILL.md) when adding, changing, or assessing tests.

Keep the implementation limited to the requested contracts and necessary operational behavior. Put runtime limits, retry identity, cancellation, and partial failure into the design when the workload requires them. Strong types help preserve validated state; runtime inputs and external systems still need validation and evidence.

Resolve stale generated code through the project's generator or environment check. Inspect whether that command is local or synchronizes an external environment, then run it when authorized. Do not create substitute generated types or widen types to hide the missing contract. If a prerequisite is unavailable, finish independent work and identify the exact remaining command and blocker.

When work can run independently, give each worker a bounded scope, file ownership, input artifacts, and a verification task. Integrate results and inspect their evidence; a worker's confidence is not a check result. Parallelize independent reads and checks, and serialize edits or commands that share mutable state.

## Verify the claim

Use focused checks while iterating, then complete the repository's required gate on the final changes. Distinguish a mechanical check failure from an advisory review finding by reading the actual output. Address findings relevant to the change without turning repeated scans into an endless loop.

Choose proof at the place the behavior can fail: real filesystem semantics for a file writer, a consumer install for package exports, browser interaction for focus behavior, or an authorized test service for an API contract. A fake, static render, or successful compilation proves only its own boundary.

Run required checks again after changes that invalidate their result. Broaden validation when failures or unresolved risks justify it. A skipped test, empty selection, stale artifact, or unavailable environment is not passing evidence. Preserve a skipped or blocked status and continue checks that can run.

Inspect the final diff for accidental scope expansion, debug output, temporary artifacts, and unintended changes from generators or formatters. Remove only temporary work created for this task. Before an unauthorized external action, make the local result concrete and reviewable, then request the missing authorization.

## Handoff

Lead with the resulting behavior. Give the checks actually run, their relevant result, and any remaining material limit. Link larger evidence when useful; keep the final answer understandable without earlier progress messages. Do not claim completion while a required gate is failing or a requested behavior remains unimplemented.

```ts
/**
 * @attribution https://github.com/mattpocock/skills/tree/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/diagnosing-bugs (MIT; independent inspiration for symptom-led diagnosis)
 */
```
