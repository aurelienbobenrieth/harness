---
"@aurelienbbn/oxlint-plugin-effect": minor
---

Adds `effect/schema-check-branded`: in a domain folder (`**/domain/**` by default, option `files`; tests and scripts skipped, option `allow`), a schema that adds a check (`Schema.check(...)` in a pipe, or a `.check(...)` call) with no `Schema.brand` in the same chain is reported. A check runs only on decode, encode and `make`, so without a brand its type is the unchecked one and code can build a value the check refuses. No autofix.
