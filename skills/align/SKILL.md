---
name: align
description: Settle open requirements, domain language and fact ownership before building, by resolving decisions in dependency order and recording shared terms. Use when a request leaves several interdependent decisions open, a domain term is ambiguous or conflicts with the glossary, stated behavior contradicts the code, or the user asks to be questioned on a plan; also before building a feature that needs a fact another context owns, or adds a stored fact or a contract another module depends on. Not for a change inside one feature (see build) or a single missing answer (ask it inline).
---

# Align

- Nothing built on a silent assumption. The user answers only what only they can.
- Map decisions as a tree; ask one only after its dependencies settle. Facts (code, docs, config, history): look up yourself; ask only decisions/preferences.
- Settled decisions and existing authorization are inputs, slow layers included. Reopen only on new evidence that changes the outcome; show it and its consequence.
- Small batches: recommendation + consequence per option. One-word accept-all, except slow layers.
- Stated behavior contradicts code: show both, ask which is intended.
- Done: every branch decided or deferred; one summary table; hand off to implementation.

## Slow layers: user states first

Slow = costly to reverse: stored data shape, contract another module/app depends on, external side effect (email, payment, third-party write), new module dependency.

1. User's hypothesis first (need, end-user view, data; 5 lines, their words). Yours only after.
2. Challenge with facts: missed cases, code contradictions, duplicates. Then recommendation as a delta on it; record hypothesis + delta with the decision.

## Model

- Each fact has one owning context. Another context reads it through what the owner publishes (a narrow answer such as rights for a store, or an event), never through its aggregate's state or its ports; a missing published read is part of the plan, not a reason to read the state.
- Read on demand by default. Keep a local copy fed by an event only when the owner's fact guards one of the consumer's own commands.
- A fact that crosses a context gets a row in the summary table: fact, owner, how it is read.

## Language

- Term used two ways/clashing with the glossary: name it, propose one meaning, use it in talk, code, tests.
- Glossary: existing domain doc; if none, create `docs/glossary.md` once a term settles (one line per term: meaning, and what it is not). Decision record only when hard to reverse, surprising to a newcomer, and traded real alternatives; else the commit message suffices.
