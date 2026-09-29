---
"@aurelienbbn/oxlint-config": minor
---

`effectIdiomRules` turns off `eslint/max-classes-per-file`: tagged errors, `Schema.Class` models and services are classes, so a domain module that keeps its schemas beside the errors it raises no longer has to split into one file per class.
