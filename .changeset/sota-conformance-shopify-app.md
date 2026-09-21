---
"@aurelienbbn/conformance-shopify-app": minor
---

Extend `api-version-contract` to read the literal `apiVersion` of the app server module (`serverEntries` option), apply the configured bounds to it, and warn when it differs from the selected manifest's webhook API version. Add the opt-in `extension-capability-contract` check through `optionalShopifyAppChecks`; `shopifyAppConformance`, `runShopifyAppConformance`, and `runShopifyAppConformanceReport` accept an explicit check list. Default runs are unchanged apart from the new API version findings.
