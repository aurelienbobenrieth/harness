---
"@aurelienbbn/conformance-shopify-theme": minor
---

Expand the conformance suite from 7 to 30 checks: schema validity (section-schema-valid, visible-if-references, preset-validity, preset-completeness), LiquidDoc (liquiddoc-required, liquiddoc-params), rendering quality (image-dimensions, image-policy, lcp-priority, heading-order, landmarks, stylesheet-scope), registry contracts (registry-sync, surface-classes with the five surface.* invariants), machine-readable contracts (event-contract, token-contract), coverage (route-coverage, schema-locale-keys, orphan-locale-keys), and gates (asset-budget, contrast-guard, meta-completeness, utility-grammar). All configurable via ConformanceRunOptions, with skipChecks for themes that do not adopt the registry/event contracts.
