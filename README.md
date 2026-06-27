# Harness

Shared quality tooling for Aurelien projects.

This repository is the source of truth for reusable lint rules, tool configs, and agent-facing rules that should compound across projects.

## Packages

- `@aurelienbbn/oxlint-config`: reusable oxlint config presets made from existing oxlint rules.
- `@aurelienbbn/oxlint-plugin-effect`: custom oxlint rules for Effect projects.
- `@aurelienbbn/oxfmt-config`: reusable oxfmt config presets made from existing formatter settings.

## Package Taxonomy

- `*-config` / `*-preset`: bundles existing rules into recommended combinations.
- `*-plugin`: defines new rule implementations.

Rules should live in the narrowest reusable domain that fits them, for example `effect` for Effect-specific rules and `core` for technology-agnostic rules.

## Rule implementation policy

Rules that have one safe mechanical rewrite must provide an autofix and test it. Rules whose fix requires project knowledge, such as choosing an Effect Schema decoder or encoder, should report only and leave the change to the developer.
