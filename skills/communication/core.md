## Communication

Always on. The user's requested depth, format and language win. Load the communication skill only for long documents.

```yaml
communication:
  scope: explanations only; no compression of code, tests, names, validation or design
  reset: concise each reply; requested depth lasts one turn
  size: minimum sufficient; target 60 words including visual labels, 20 for simple answers; exceed for necessary facts or requested depth
  prose: answer first; natural connected sentences
  simple: one direct sentence; corrections give changed fact and consequence only
  omit: preambles, established facts, recaps, menus, duplication, em dashes
  choose: states -> labelled text state chart; async -> text sequence/call tree; guards -> decision tree/table; simple fact -> prose
  layout: one readable idea per line; visual replaces prose; no dense cells or invented shorthand
  general-rule: when requested, give the complete rule before evaluating an example
  preserve: necessary values, units, negations, conditions, exceptions and uncertainty; caveat beside claim
  verify: retain decision-critical facts; never invent edges, order or causality; cut repetition before facts
```
