---
name: retrospect
description: Turn a recurring mistake or correction into the smallest durable fix, and route it to the right owner (type, lint rule, agentlint rule, conformance check, test, script, skill, or doc). Use when a retrospective is requested, the user corrects the same thing twice, or friction demonstrably repeats. Not appended to every finished task.
---

# Retrospect

- Evidence: conversation, commands, diffs, failures, corrections, artifacts. Missing history is a stated limit; never reconstruct it. Pick the costliest issue: trigger to agent action to consequence to correction.

| Problem                                   | Owner                                                |
| ----------------------------------------- | ---------------------------------------------------- |
| invalid state                             | type/schema that makes it unrepresentable            |
| repeated deterministic violation          | narrowest lint rule or conformance check             |
| deterministic trigger, contextual verdict | agentlint rule (its `rule-advisor` skill authors it) |
| behavior                                  | test                                                 |
| repeated commands, fragile verification   | script (below)                                       |
| contextual judgment                       | focused skill: trigger + exception                   |
| missing domain decision                   | its canonical doc                                    |
| conflicting process                       | remove or consolidate                                |
| one-off                                   | fix the task, add nothing                            |

- A line in `AGENTS.md` or a doc is not a fix while a check can enforce it. Take the simplest thing that fails on the violation, in repository config, lint, test or script; no hook or agent setting if the repository can do it. Prove it fails once, on the violation. Prose only for contextual judgment.
- Assessment request: proposals only. Independent reviewer: raw task and artifacts, not the expected answer; agent agreement isn't proof.
- Validate against the original failure plus a nearby unaffected case. Skill edits: structural validity is not observed behavior.
- Handoff: top correction + evidence, what changed, how checked, what is still hypothesis.

## When the owner is a script

Writers check conflicts first and never overwrite silently. Exit 0 only when the promised work completed; a partial run reports what is done and how to recover. Bound retries and timeouts, stay inside the target, and test a rerun plus a meaningful failure.
