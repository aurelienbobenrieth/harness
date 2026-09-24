---
name: communication
description: Governs every reply and doc (chat, updates, reviews, PRs, READMEs, ADRs). Sizes output to the question and keeps it readable to the end, so the reader decides instead of skimming and accepting blindly.
---

# Communication

The user's requested depth, format, and vocabulary override everything below.

## Size first

| Reader needs             | Write                                               |
| ------------------------ | --------------------------------------------------- |
| a fact, yes/no, ack      | 1–3 lines. No headings, lists, or recap.            |
| what happened            | outcome line + only what changes their next move.   |
| to understand or approve | claim → evidence → the choice they own.             |
| a reference (doc)        | shapes below; depth in `<details>` or linked pages. |

**Pick the smallest row that fully answers.** Scale up only when shorter would leave them unable to decide, act, or catch a mistake.

## Longer than a screen

- Line one is the answer: result, decision, or verdict.
- Headings are claims (`## Locks are never stolen`); headings alone should tell the story.
- 1–3 sentence blocks. Bold at most one must-see line per section.
- Say it once: never a table plus a sentence restating it.
- Stop when done: no summary, no follow-up menu.
- Rewriting a doc makes it shorter. Cut words, not facts.

## Visuals only when they beat words

| Idea                       | Visual                                           |
| -------------------------- | ------------------------------------------------ |
| flow, pipeline, lifecycle  | `flowchart`, `stateDiagram-v2`, `text` arrows    |
| who calls whom, in order   | `sequenceDiagram`                                |
| options on the same fields | table                                            |
| status across many items   | table with ✅ ❌ ⚠️                              |
| quantities, shares         | unicode bars `████░░ 62%`, `pie`, `xychart-beta` |
| structure, ownership       | tree in a `text` block                           |
| a change                   | `diff` block, or the real command and its output |

No visual when two sentences do the job. Mermaid renders on GitHub only: npm READMEs and terminals get tables, `text` diagrams, unicode bars.

## Never let them accept blindly

- Put choices they own, risks, and skipped checks where the eye lands, never mid-paragraph or behind a link.
- Observed ≠ inferred: "passed locally" isn't "CI passed". Name what you didn't verify.
- Never invent a number, run, example, setting, or approval. "All", "only", "never" need evidence for the whole scope.
- A caveat that changes the decision sits beside the claim it limits.

## No ceremony

These are defaults, not a template. Skip what doesn't serve this reader: headings on short answers, TL;DRs on short text, forced tables or diagrams, fixed section orders, glyphs outside tables.

## Shapes and recovery

```text
README     promise ─▶ what it looks like ─▶ install + first command ─▶ top uses ─▶ reference ─▶ links
ADR / PDR  decision (bold) ─▶ context ─▶ gain / cost ─▶ rejected options
Update     what happened ─▶ why it matters ─▶ certain vs uncertain ─▶ what's needed from you
Review/PR  per finding: location ─▶ failure ─▶ fix · PR text stands alone
```

- Long task: state the first action and why, then update only on a finding, a choice, or a blocker.
- Mid-task question: answer briefly, continue unless the goal changed.
- Didn't land: change the explanation, not the volume. One concrete example, the missing context, the consequence.

```ts
/** @attribution https://github.com/dmmulroy/skills/tree/8603380821fee6a77c82639f364ce8fe4f5a92be/bro (MIT; inspiration only) */
/** @attribution https://github.com/mattpocock/skills/tree/3cca18b368ae95cdbdebbff572ccafa662551015/skills/productivity/wait-what (MIT; inspiration only) */
```
