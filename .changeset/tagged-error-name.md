---
"@aurelienbbn/oxlint-plugin-effect": minor
---

Add `tagged-error-name`, which reports a class extending `Schema.TaggedError`, `Schema.TaggedErrorClass` or `Data.TaggedError` whose name lacks the error suffix (option `suffix`, default `"Error"`) or whose literal `_tag` differs from the class name. Report only: a rename crosses files.
