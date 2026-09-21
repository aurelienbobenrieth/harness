---
"@aurelienbbn/agentlint-plugin-core": minor
"@aurelienbbn/agentlint-plugin-effect": minor
"@aurelienbbn/agentlint-plugin-shopify-app": minor
"@aurelienbbn/agentlint-plugin-tanstack-query": minor
"@aurelienbbn/agentlint-plugin-xstate": minor
"@aurelienbbn/conformance-core": minor
"@aurelienbbn/conformance-shopify-app": minor
"@aurelienbbn/oxfmt-config": minor
"@aurelienbbn/oxlint-config": minor
"@aurelienbbn/oxlint-plugin-core": minor
"@aurelienbbn/oxlint-plugin-effect": minor
"@aurelienbbn/oxlint-plugin-shopify-app": minor
"@aurelienbbn/oxlint-plugin-type-evidence": minor
"@aurelienbbn/oxlint-plugin-xstate": minor
---

Require Node 22.19.0 or Node 24.11.0 and later patches within those major lines, matching the draft CLI dependency engine. Raise the Vite Plus peer floor to 0.3.2 and the Vitest peer floor to 4.1.11 so the supported baseline includes the browser file-access security fix. The oxlint floor moves to 1.82.0, oxfmt to 0.67.0 (0.68 included), Stylelint to 17.15.0 and oxlint-tsgolint to 7.0.2001, matching the toolchain Vite Plus 0.3.2 bundles. Consumers on earlier host versions must upgrade before adopting this release.

Update the conformance parsers to PostCSS 8.5.28, parse5 8.0.1 and smol-toml 1.8.0, refresh compatible transitive dependencies, and audit all dependency categories without ignored advisories. No cross-major security overrides are introduced.
