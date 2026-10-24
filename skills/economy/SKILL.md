---
name: economy
description: Delegates and runs long agent work on a token budget, with compact briefs, budgets, context hand-offs, cache-aware waits, milestone-only status. Use when spawning subagents or child tasks, fanning out builders or reviewers, or starting a long autonomous run. The always-on reading and output rules live in core.md, which AGENTS.md carries. Not for what the work itself should be (see build, code-review).
---

# Economy

[core.md](core.md) is always on and already loaded through `AGENTS.md`; this skill adds what delegation and long runs need. Measured on 2026-10 transcripts: subagents were 66 % of Claude spend, and calls above 200k tokens of context were 64 %.

## Brief

Every delegated task gets one brief, readable without the parent's history:

```text
GOAL       one sentence: the outcome, not the activity
SCOPE      files or folders it owns; file:line pointers when known
NOT        what it must not touch or decide
DONE-WHEN  checks that prove it (named commands), or the question answered
BUDGET     max tool calls, max context, max review rounds
REPLY      at most 10 lines: done / left / blocked; detail in a file it names
```

A brief repeated across tasks becomes a stored template with parameters, not pasted prose.

## Budgets and hand-offs

- **One or two slices per agent.** Bigger batches run for hours at ~200k of context, re-read on every call.
- **Context ceiling ~200k.** Past it, the agent writes a hand-off file (done, left, decisions, traps, next command) and stops; a fresh agent resumes from that file.
- **Same failure three times:** stop and report `BLOCKED` with the three traces. No fourth try.
- **Reviews:** blockers only, two rounds at most. A fix-soon goes back to the same agent, or the parent fixes it when small.

## Waits and cache

- Claude Code subagents (the Agent tool) cache their prompt for 5 minutes; the main thread and host child tasks (T3 Code `delegate_task`, separate threads) keep it for 1 hour. Verified on T3 Code, 2026-10. A subagent call that waits longer than 5 minutes (a gate, a test suite, another agent) rewrites its whole context at write price.
- Long or wait-heavy work: a host child task, or the parent runs the slow command. A native subagent keeps each tool call under 5 minutes.

## Model and effort

The cheaper model for bounded, well-specified work (a slice with pointers, a scoped review, a digest). The top model for design, unknown-cause debugging, and reviews of money, security, or authority. Status questions never go to the busiest agent.

## Status without asking

- Agents report only lines a tool can parse: `MILESTONE <what>`, `BLOCKED <need>`, `DONE <proof>`. No interim chatter: each notification wakes the parent over its whole context.
- Questions for the human go to the project's inbox, one item per question, with a safe default and a deadline when one exists.
