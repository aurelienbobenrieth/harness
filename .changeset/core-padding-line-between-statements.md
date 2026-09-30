---
"@aurelienbbn/oxlint-plugin-core": minor
---

Adds `core/padding-line-between-statements`: ESLint's rule of the same name (its `{ blankLine, prev, next }` options and statement types, autofixed), except that a comment block above a statement belongs to it, so the blank line goes above the comments. Enabled without options, it pads around blocks and multiline expressions, after a run of `const`/`let` declarations, and before `return` and `throw`. `core/padding-before-exit` is deprecated: that default covers it, and `{ blankLine: "always", prev: "*", next: ["return", "throw"] }` alone reproduces it. Turn it off when you enable the new rule; it still works until a later minor removes it.
