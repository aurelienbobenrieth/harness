# @aurelienbbn/oxlint-plugin-xstate

Custom oxlint rules for XState machines and actors. Complements `eslint-plugin-xstate` with fast syntactic checks that oxlint can run on every file.

## Rules

- `xstate/machine-naming`: machine ids passed to `createMachine`/`setup().createMachine` must match the configured `pattern` (default `^oio\.[a-z0-9-]+$`) so actors stay namespaced and traceable across the system.
