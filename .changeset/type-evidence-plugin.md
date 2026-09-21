---
"@aurelienbbn/oxlint-plugin-type-evidence": minor
---

Add the type-evidence oxlint plugin with 10 report-only rules preserving TypeScript type evidence: assertion hygiene (no-chained-type-assertions, require-safety-comment-for-type-assertion with configurable markers), boundary contracts (no-object-parameters, no-unknown-parameters, no-unknown-returns, no-unknown-type-aliases), dictionary contracts (no-unsafe-dictionary-type), evidence flow (no-known-value-widening, no-widen-then-assert), and runtime narrowing (no-runtime-typeof with allowInTypeGuards). Ships a single strict preset via the strictRules export that sets every rule to error. Rules are re-implementations of concepts from dmmulroy/anti-slop (MIT).
