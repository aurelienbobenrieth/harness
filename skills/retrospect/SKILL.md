---
name: retrospect
description: Turn session evidence and user corrections into the smallest durable fix for a recurring workflow problem. Use when a retrospective is requested or friction has demonstrably repeated; never append one to a finished task.
---

# Retrospect

- Evidence: conversation, commands, diffs, failures, corrections, artifacts. Missing history is a stated limit; never reconstruct it.
- Pick the costliest issue. Name trigger → agent action → consequence → correction.
- One isolated mistake ≠ universal rule. The user's communication style is never the defect.
- Owner by problem:
  - repeated deterministic violation → narrowest compiler, lint, or conformance check
  - repeated commands, fragile verification → existing script or harness
  - contextual judgment → focused skill: trigger + exception
  - missing domain decision → its canonical doc
  - conflicting process → remove or consolidate
  - one-off → fix the task, add nothing
- State benefit and maintenance cost before adding a tool or instruction.
- Assessment request → proposals only. "Improve the workflow" → local edits authorized without per-file asks; publishing still needs its own.
- Independent reviewer: give raw task and artifacts, not the expected answer. Agent agreement isn't proof.
- Validate against the original failure plus a nearby case that must stay unaffected. Skill edits: structural validity ≠ observed behavior.
- Handoff: top correction and evidence, what changed, how checked, what is still hypothesis. No session replay, no never-again promises.
