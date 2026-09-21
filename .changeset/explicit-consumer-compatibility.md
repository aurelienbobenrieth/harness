---
"@aurelienbbn/agentlint-plugin-core": patch
"@aurelienbbn/agentlint-plugin-effect": patch
"@aurelienbbn/agentlint-plugin-shopify-app": patch
"@aurelienbbn/agentlint-plugin-tanstack-query": patch
"@aurelienbbn/agentlint-plugin-xstate": patch
"@aurelienbbn/conformance-core": patch
"@aurelienbbn/conformance-shopify-app": patch
"@aurelienbbn/oxfmt-config": patch
"@aurelienbbn/oxlint-config": patch
"@aurelienbbn/oxlint-plugin-core": patch
"@aurelienbbn/oxlint-plugin-effect": patch
"@aurelienbbn/oxlint-plugin-shopify-app": patch
"@aurelienbbn/oxlint-plugin-type-evidence": patch
"@aurelienbbn/oxlint-plugin-xstate": patch
---

Bound Node and peer compatibility to reviewed release families, correct repository metadata, and distinguish registry consumer evidence from private draft integration tests. Keep oio and the seven agentlint plugins private: the reviewed local agentlint archive has an incompatible API with the public package carrying the same version. Pin its integrity and test the thirteen public candidates against explicit baseline and current compatible tool versions, strict peer installation, and complete public declaration resolution.

Import configuration types through the focused Vite Plus lint and format entry points, preventing unrelated build-tool declaration errors from leaking into config consumers.
