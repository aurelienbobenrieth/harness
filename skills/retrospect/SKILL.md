---
name: retrospect
description: Examine session evidence and user corrections to improve a recurring workflow. Use for a requested retrospective or demonstrated repeated friction; do not append a retrospective to every completed task.
---

# Retrospect

Identify the smallest durable change that would have prevented a demonstrated problem. Use the conversation, commands, diffs, failures, corrections, and delivered artifacts as evidence. Missing history is an evidence limit, not permission to reconstruct events.

## Explain the cause

Choose the issue with the clearest effect on correctness, attention, or repeated effort. Separate what happened from why it may have happened. A useful account names the triggering situation, the agent's action, the observed consequence, and the correction.

Check whether the cause was missing information, ignored instructions, tool behavior, a misleading test, or a conflicting workflow. Do not turn an isolated mistake into a universal rule. Do not treat the user's communication style as the defect; identify what the agent could discover, infer, or explain better.

## Pick an owner

| Demonstrated problem                       | Durable response                                                    |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Repeated deterministic violation           | Extend the narrowest existing compiler, lint, or conformance check. |
| Repeated commands or fragile verification  | Improve the existing script or test harness.                        |
| Judgment depends on context                | Tighten a focused skill with its trigger and exception.             |
| Important domain decision is missing       | Update its canonical decision or domain document.                   |
| Conflicting or redundant process           | Remove or consolidate the source of friction.                       |
| One-off uncertainty with no recurring cost | Resolve the task without adding permanent machinery.                |

State the expected benefit and maintenance cost before adding another tool or instruction. Prefer a small correction that can be evaluated against the original failure and a nearby case that should remain unaffected.

## Apply within scope

An assessment-only request calls for findings and proposals. A request to improve the workflow authorizes relevant local edits; preserve that authorization instead of asking again for each skill or script. Respect separate constraints on publishing, deployment, external messages, and unrelated changes.

Use independent review when it can test the interpretation with fresh context. Give the reviewer the raw task and relevant artifacts, and avoid revealing the expected answer when testing behavior. Do not treat agreement between agents as proof without inspecting the resulting action or artifact.

Run appropriate validation for implemented changes. For a skill, distinguish structural validity from observed behavior in realistic tasks. For a tool or rule, verify the original failure and a valid input that must remain unaffected.

## Handoff

Lead with the most useful correction and its evidence. State what changed, how it was checked, and what remains a proposal or untested hypothesis. A short session may need one paragraph. Link substantial evidence rather than replaying the conversation or promising that the issue can never recur.
