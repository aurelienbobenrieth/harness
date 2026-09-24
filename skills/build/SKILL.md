---
name: build
description: Carry an authorized feature, fix, or refactor from inspection through implementation and verified evidence. Not for explanation-only requests or pure git operations (see git).
---

# Build

## Before editing

- Inspect the working tree first; existing work must survive.
- Read validation commands and their side effects from config; `check` or `dev` may not do what the name says.
- "Can you fix this?" → act. Ask only for an outcome-changing decision or an action outside authorization. Higher stakes → more proof, not another approval round.
- Several interacting behaviors → list trigger → expected outcome → proof. No spec doc per edit.
- Unknown cause or unfamiliar boundary → small probe before choosing the design.
- Missing business decision → state the consequence, ask one question, continue independent work.

## Implement

- Defect → reproduce the symptom at its boundary; test one falsifiable hypothesis, cheapest observation first. No reproduction → name the missing condition; the cause stays provisional.
- Prefer a regression test that fails before the fix. Tests → read [testing](../testing/SKILL.md).
- Design in runtime limits, retry identity, cancellation, partial failure where the workload needs them.
- Stale generated code → run the project's generator (check first whether it syncs externally). Never hand-write substitute types or widen types. Prerequisite unavailable → finish independent work, report the exact blocked command.
- Parallel workers: bounded scope, file ownership, inputs, verification task each. Trust their evidence, not their confidence. Serialize anything sharing mutable state.

## Verify

- Focused checks while iterating; full repo gate on the final state. Rerun checks a later change invalidated.
- Prove at the failure boundary: real filesystem for a file writer, consumer install for package exports, browser interaction for focus, authorized test service for an API. A fake, static render, or compile proves only itself.
- Skipped test, empty selection, stale artifact, unavailable environment ≠ pass. Report it as skipped/blocked.
- Final diff: remove your debug output, temp files, and unintended formatter churn.
- Unauthorized external action → leave a reviewable local result, request authorization.

## Handoff

Resulting behavior, checks run and results, material limits; readable without earlier progress messages. Never claim done with a failing gate or unimplemented request.

```ts
/**
 * @attribution https://github.com/mattpocock/skills/tree/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/diagnosing-bugs (MIT; independent inspiration for symptom-led diagnosis)
 */
```
