# @aurelienbbn/oxlint-plugin-core

Custom oxlint rules for TypeScript projects.

## Rules

- `core/no-exported-anonymous-object-return`: require exported functions to return named contracts instead of anonymous object shapes.
- `core/no-multi-positional-parameters`: require functions to use one object input instead of multiple positional parameters.

## Autofix

`core/no-exported-anonymous-object-return` is not autofixable because naming a public contract requires choosing the schema/type name and export location.
`core/no-multi-positional-parameters` is not autofixable because changing call signatures requires updating callers and choosing property names.
