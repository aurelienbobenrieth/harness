# @aurelienbbn/oxlint-plugin-core

Custom oxlint rules for TypeScript projects.

## Rules

- `core/no-exported-anonymous-object-return`: require exported functions to return named contracts instead of anonymous object shapes.
- `core/no-multi-positional-parameters`: require functions to use one object input instead of multiple positional parameters.
- `core/no-mutable-exported-state`: require modules to export immutable contracts or factories instead of mutable state.
- `core/no-vitest-in-source`: require Vitest imports to stay in test files, setup files, config files, or test utilities.

## Autofix

`core/no-exported-anonymous-object-return` is not autofixable because naming a public contract requires choosing the schema/type name and export location.
`core/no-multi-positional-parameters` is not autofixable because changing call signatures requires updating callers and choosing property names.
`core/no-mutable-exported-state` is not autofixable because replacing shared mutable state requires choosing a factory, immutable contract, or dependency boundary.
`core/no-vitest-in-source` is not autofixable because moving test-only APIs out of production source requires choosing the correct test utility or dependency seam.
