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
| repeated commands, fragile verification   | script ([toolsmith](../toolsmith/SKILL.md))          |
| contextual judgment                       | focused skill: trigger + exception                   |
| missing domain decision                   | its canonical doc                                    |
| conflicting process                       | remove or consolidate                                |
| one-off                                   | fix the task, add nothing                            |

- Assessment request: proposals only. Independent reviewer: raw task and artifacts, not the expected answer; agent agreement isn't proof.
- Validate against the original failure plus a nearby unaffected case. Skill edits: structural validity is not observed behavior.
- Handoff: top correction + evidence, what changed, how checked, what is still hypothesis.
