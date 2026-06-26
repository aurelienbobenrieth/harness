# Harness

Shared quality tooling for Aurelien projects.

This repository is the source of truth for reusable lint rules, lint configs, and agent-facing rules that should compound across projects.

## Packages

- `@aurelienbbn/oxlint-config`: reusable oxlint config presets made from existing oxlint rules.
- `@aurelienbbn/oxlint-plugin-effect`: custom oxlint rules for Effect projects.

## Package Taxonomy

- `*-config` / `*-preset`: bundles existing rules into recommended combinations.
- `*-plugin`: defines new rule implementations.

Rules should live in the narrowest reusable domain that fits them, for example `effect` for Effect-specific rules and `core` for technology-agnostic rules.
