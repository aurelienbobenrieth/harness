---
name: communication
description: Shapes long-form prose for a person (READMEs, ADRs and PDRs, PR descriptions, reference docs, long reviews or updates) so the reader finishes it and decides instead of accepting blindly. Use when writing or rewriting a document longer than a screen. Always-on reply rules live in core.md, carried by AGENTS.md. Never changes code; code quality belongs to build.
---

# Communication

[core.md](core.md) is always on via `AGENTS.md`; this adds long documents. The user's requested depth, format, and vocabulary still win.

## Longer than a screen

- Headings alone tell the story; depth in `<details>` or a linked page.
- Say it once: no table plus a restating sentence. Bold at most one must-see line per section.
- Rewriting makes it shorter. Cut words, not facts.

## Visual by the reader's question

[visuals](references/visuals.md): question to visual + snippet for the target medium. Mermaid on GitHub only; npm READMEs, terminals, chat get tables, `text` diagrams, unicode bars.

## Never let them accept blindly

- Choices they own, risks, skipped checks where the eye lands, never mid-paragraph or behind a link.
- A caveat that changes the decision sits beside the claim it limits.

## Shapes

README: promise -> looks -> install + first command -> top uses -> reference. ADR/PDR: decision (bold) -> context -> gain/cost -> rejected options. Update: happened -> why -> certain vs uncertain -> what's needed. Review/PR: location -> failure -> fix. Drop any step this reader doesn't need.

