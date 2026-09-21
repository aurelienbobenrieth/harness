---
"@aurelienbbn/oxlint-config": minor
"@aurelienbbn/oxfmt-config": minor
"@aurelienbbn/oxlint-plugin-effect": patch
"@aurelienbbn/oxlint-plugin-core": patch
"@aurelienbbn/conformance-core": patch
"@aurelienbbn/conformance-shopify-app": patch
---

Make the Oxlint and Oxfmt presets depend on their direct host contracts instead of Vite+, keep independent variable bindings as separate declarations, recognize named TypeScript and JSDoc return contracts, preserve namespaces in matching Effect identifiers, enable multiline JSDoc formatting, migrate the local agentlint draft consumers to named callback arguments, and verify both conformance adapters across Vitest 4 and 5.
