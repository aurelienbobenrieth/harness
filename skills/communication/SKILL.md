---
name: communication
description: Shapes long-form prose for a person (READMEs, ADRs and PDRs, PR descriptions, reference docs, long reviews or updates) so the reader finishes it and decides instead of accepting blindly. Use when writing or rewriting a document longer than a screen. The always-on rules for every reply live in core.md, which AGENTS.md carries. Never changes code structure or naming; code quality belongs to build.
---

# Communication

[core.md](core.md) is always on and already loaded through `AGENTS.md`; this skill adds what long documents need. The user's requested depth, format, and vocabulary still win.

## Longer than a screen

- Headings alone tell the story; depth goes in `<details>` or a linked page.
- Bold at most one must-see line per section.
- Say it once: never a table plus a sentence restating it.
- Rewriting a doc makes it shorter. Cut words, not facts.

## Pick the visual by the reader's question

[visuals](references/visuals.md) maps each question to a visual and a snippet that renders on the target medium: user flow, sequence, states, event storming, data shape, system boundaries, flamegraph, volumes, two-axis trade-offs, timelines, plus the tables, trees, and diffs. Mermaid renders on GitHub only; npm READMEs, terminals, and chat get tables, `text` diagrams, unicode bars.

## Never let them accept blindly

- Choices they own, risks, and skipped checks go where the eye lands, never mid-paragraph or behind a link.
- A caveat that changes the decision sits beside the claim it limits.
- "All", "only", "never" need evidence for the whole scope.

## Shapes

```text
README     promise ─▶ what it looks like ─▶ install + first command ─▶ top uses ─▶ reference ─▶ links
ADR / PDR  decision (bold) ─▶ context ─▶ gain / cost ─▶ rejected options
Update     what happened ─▶ why it matters ─▶ certain vs uncertain ─▶ what's needed from you
Review/PR  per finding: location ─▶ failure ─▶ fix · PR text stands alone
```

Defaults, not a template: drop any step this reader doesn't need.

## Recovery

- Long task: state the first action and why, then update only on a finding, a choice, or a blocker.
- Mid-task question: answer briefly, continue unless the goal changed.
- Didn't land: change the explanation, not the volume. One concrete example, the missing context, the consequence.
