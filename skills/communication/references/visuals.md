# Visuals by question

Load when a reply/doc carries structure, flow, or numbers. Pick by the reader's question. Two sentences that do the job beat any diagram.

Rendering: GitHub (README, PR, issue) renders Mermaid, tables, `diff`, `<details>`. npm README, terminal, chat: tables, `text`, unicode bars, `diff` (Mermaid shows as source).

## Catalog

- User steps: user flow (A). Who calls whom, in order: `sequenceDiagram` (B). States/transitions: `stateDiagram-v2` (C).
- Business events, commands, aggregates: event storming (D). Data shape: `erDiagram` (E). Systems/boundaries: context map, `flowchart` + `subgraph` (F).
- Where time goes: flamegraph file + text icicle (G). Volume split/flow: `sankey-beta`, `pie`, unicode bars (H).
- Options on same fields, or status across many items: table. What changed: `diff` or real command + output. Ownership, open/dependent decisions: tree in a `text` block.

## Snippets

A: `flowchart LR` (nodes = screens/actions, choice on the edge). B: `sequenceDiagram` (one lifeline per process/service, async `-),` failure path noted). C: `stateDiagram-v2` (one transition per line). D: event storming `flowchart` + `classDef` (command blue, event orange, aggregate yellow, policy purple). E: `erDiagram`. F: context map `flowchart` + `subgraph` per boundary. G: flamegraph file + text icicle (total line, indented bars, width = share). H: `sankey-beta`/`pie`/unicode bars. I: `quadrantChart`. J: `timeline`.
