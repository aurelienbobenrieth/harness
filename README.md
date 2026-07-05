# Harness

Shared quality tooling for Aurelien projects.

This repository is the source of truth for reusable lint rules, tool configs, and agent-facing rules that should compound across projects.

## Packages

- `@aurelienbbn/oxlint-config`: reusable oxlint config presets made from existing oxlint rules.
- `@aurelienbbn/oxlint-plugin-core`: custom oxlint rules for TypeScript projects.
- `@aurelienbbn/oxlint-plugin-effect`: custom oxlint rules for Effect projects.
- `@aurelienbbn/oxlint-plugin-shopify-app`: custom oxlint rules for Shopify app and extension code.
- `@aurelienbbn/oxlint-plugin-shopify-theme`: custom oxlint rules for Shopify theme JavaScript.
- `@aurelienbbn/oxlint-plugin-lit`: custom oxlint rules for Lit templates.
- `@aurelienbbn/oxlint-plugin-xstate`: custom oxlint rules for XState machines and actors.
- `@aurelienbbn/stylelint-plugin-shopify-theme`: custom stylelint rules for Shopify theme CSS.
- `@aurelienbbn/agentlint-plugin-core`: custom agentlint rules for general TypeScript projects.
- `@aurelienbbn/agentlint-plugin-effect`: custom agentlint rules for Effect projects.
- `@aurelienbbn/agentlint-plugin-tanstack-query`: custom agentlint rules for TanStack Query projects.
- `@aurelienbbn/agentlint-plugin-shopify-app`: custom agentlint rules for Shopify app and extension code.
- `@aurelienbbn/agentlint-plugin-shopify-theme`: custom agentlint rules for Shopify theme JavaScript.
- `@aurelienbbn/agentlint-plugin-lit`: custom agentlint rules for Lit components.
- `@aurelienbbn/agentlint-plugin-xstate`: custom agentlint rules for XState machines and actors.
- `@aurelienbbn/conformance-shopify-app`: structural conformance checks for Shopify apps, packaged as a Vitest suite.
- `@aurelienbbn/conformance-shopify-theme`: structural conformance checks for Shopify themes, packaged as a Vitest suite.
- `@aurelienbbn/oxfmt-config`: reusable oxfmt config presets made from existing formatter settings.
- `@aurelienbbn/oio`: Theme OS CLI (registry sync/check, surface audit, budgets, scaffolding) in Effect TS.

## Package Taxonomy

- `*-config` / `*-preset`: bundles existing rules into recommended combinations.
- `*-plugin`: defines new rule implementations.
- `conformance-*`: structural checks over manifests, file layout, and build output, consumable as a Vitest suite or programmatically.

Rules should live in the narrowest reusable domain that fits them, for example `effect` for Effect-specific rules and `core` for technology-agnostic rules.

## Rule implementation policy

Rules that have one safe mechanical rewrite must provide an autofix and test it. Rules whose fix requires project knowledge, such as choosing an Effect Schema decoder or encoder, should report only and leave the change to the developer.
