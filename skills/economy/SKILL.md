---
name: economy
description: Delegates and runs long agent work on a token budget, with compact briefs, budgets, context hand-offs, cache-aware waits, milestone-only status. Use when spawning subagents or child tasks, fanning out builders or reviewers, or starting a long autonomous run. Reading and output rules live in core.md, carried by AGENTS.md. Not for what the work itself should be (see build, code-review).
---

# Economy

[core.md](core.md) is always on via `AGENTS.md`; this adds delegation/long runs.

## Brief

One brief per task:

```text
GOAL       one sentence: outcome, not activity
SCOPE      files/folders owned; file:line pointers when known
NOT        what it must not touch/decide
DONE-WHEN  named checks that prove it, or the question answered
BUDGET     max tool calls, max context, max review rounds
REPLY      at most 10 lines: done / left / blocked; detail in a named file
```

## Budgets and hand-offs

- **One or two slices per agent.** Bigger batches run hours at ~200k context, re-read per call.
- **Ceiling ~200k.** Past it: hand-off file, stop; fresh agent resumes from it.
- **Same failure 3x:** stop, report `BLOCKED` with the three traces. No fourth try.
- **Reviews:** blockers only, two rounds max. Fix-soon: same agent, or parent when small.

## Waits and cache

Cache (verified T3 Code, 2026-10): Claude Code subagents (Agent tool) 5 min; main thread and host child tasks (`delegate_task`, separate threads) 1 hour. A subagent call waiting over 5 min rewrites its whole context at write price: long/wait-heavy work goes to a host child task, or the parent runs the slow command. Native subagent: each tool call under 5 min.

Model: cheaper for bounded, well-specified work (slice with pointers, scoped review, digest); top model for design, unknown-cause debugging, reviews of money/security/authority. Status questions never go to the busiest agent.

## Status without asking

- Parseable lines only: `MILESTONE <what>`, `BLOCKED <need>`, `DONE <proof>`.
