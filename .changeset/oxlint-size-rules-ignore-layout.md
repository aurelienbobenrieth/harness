---
"@aurelienbbn/oxlint-config": minor
---

Size rules no longer depend on formatting. `eslint/max-lines-per-function` is off, since `eslint/max-statements` already bounds a function by what it does. `eslint/max-lines` stays at 300 but skips blank and comment lines, so JSDoc and a narrower print width no longer count toward it.
