# @aurelienbbn/oxlint-plugin-core

Custom oxlint rules for TypeScript projects.

## Rules

- `core/no-multi-positional-parameters`: require functions to use one object input instead of multiple positional parameters.

## Autofix

`core/no-multi-positional-parameters` is not autofixable because changing call signatures requires updating callers and choosing property names.
