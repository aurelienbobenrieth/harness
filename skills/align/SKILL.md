---
name: align
description: Settle open requirements and domain language before building, by resolving decisions in dependency order and recording shared terms. Use when a request leaves several interdependent decisions open, a domain term is ambiguous or conflicts with the glossary, stated behavior contradicts the code, or the user asks to be questioned on a plan. Not for a single missing answer (ask it inline) or clear tasks (see build).
---

# Align

**Nothing gets built on a silent assumption, and the user only answers what only they can.**

## Questioning

- Map the open decisions as a tree: a decision is askable only once the ones it depends on are settled.
- Look facts up yourself (code, docs, config, history). Ask the user only for decisions and preferences.
- Ask in small batches, each question with your recommended answer and the consequence of each option. The user can accept all with one word.
- Stated behavior contradicts the code → show both, ask which is intended.
- Done when every branch is decided or explicitly deferred; then summarize the decisions in one table and hand off to [build](../build/SKILL.md).

## Language

- A term used two ways, or clashing with the glossary → name the conflict, propose one meaning, use it from then on in talk, code, and tests.
- Keep the glossary in the repo's existing domain doc; none exists → create `docs/glossary.md` only once a term is actually settled. One line per term: the meaning, and what it is not.
- Record a decision record only when the choice is hard to reverse, would surprise a newcomer, and traded real alternatives. Otherwise the commit message is enough.

```ts
/**
 * @attribution https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/productivity/grilling (MIT; inspiration: decisions as a dependency tree, look facts up and ask only for decisions)
 * @attribution https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/domain-modeling (MIT; inspiration: lazy glossary, three-part test for decision records)
 */
```
