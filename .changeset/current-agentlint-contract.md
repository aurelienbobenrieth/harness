---
"@aurelienbbn/agentlint-plugin-core": minor
"@aurelienbbn/agentlint-plugin-effect": minor
"@aurelienbbn/agentlint-plugin-shopify-app": minor
"@aurelienbbn/agentlint-plugin-tanstack-query": minor
"@aurelienbbn/agentlint-plugin-xstate": minor
---

Migrate all rule exports and presets to versioned standards, detectors, repository bindings, and array configuration. Material options are captured in binding identity and factories snapshot caller options. Add real-parser activation/silence fixtures and migrate CLI consumer tests to structured finding records.

Move Liquid reviews to change detectors with a plugin-owned Liquid parser and explicit Git baselines. Registry drift uses repository dependency snapshots instead of ambient filesystem reads. Fix repeated JSON occurrence keys, comments mistaken for executable work or visible copy, callback fan-out detection, and JavaScript type-only JSDoc review noise. Clarify valid public adapters and compile-time contracts in guidance.

These remain private draft plugins. Local development links to the sibling agentlint workspace; registry compatibility is not established by this migration.
