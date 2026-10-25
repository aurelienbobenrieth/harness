---
name: align
description: Settle open requirements and domain language before building, resolving interdependent decisions in dependency order and recording shared terms. Use when several interdependent decisions are open, a term is ambiguous or conflicts with the glossary, stated behavior contradicts code, or the user asks to be questioned on a plan. Not for a single missing answer or clear tasks (see build).
---

# Align

- Nothing built on a silent assumption. The user answers only what only they can.
- Map decisions as a tree; ask one only after its dependencies settle. Facts (code, docs, config, history): look up yourself; ask only decisions/preferences.
- Small batches: recommendation + consequence per option. One-word accept-all, except slow layers.
- Stated behavior contradicts code: show both, ask which is intended.
- Done: every branch decided or deferred; one summary table; hand off to [build](../build/SKILL.md).

## Slow layers: user states first

Slow = costly to reverse: stored data shape, contract another module/app depends on, external side effect (email, payment, third-party write), new module dependency.

1. User's hypothesis first (need, end-user view, data; 5 lines, their words). Yours only after.
2. Challenge with facts: missed cases, code contradictions, duplicates. Then recommendation as a delta on it; record hypothesis + delta with the decision.

## Language

- Term used two ways/clashing with the glossary: name it, propose one meaning, use it in talk, code, tests.
- Glossary: existing domain doc; if none, create `docs/glossary.md` once a term settles (one line per term: meaning, and what it is not). Decision record only when hard to reverse, surprising to a newcomer, and traded real alternatives; else the commit message suffices.
