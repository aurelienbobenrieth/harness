---
"@aurelienbbn/conformance-shopify-app": minor
---

Close two silent passes and add the `shopify-pattern-catalog` check.

- `api-version-contract` reports an error for every extension whose `api_version` differs from the app's `[webhooks] api_version`. Migrate: move each extension to the app's version. New opt-in `adminApiPaths: { sources, constant? }` requires every `/admin/api/<segment>/` path in those sources to name the app's version, literally or as `${constant}` with the constant declared there.
- `polaris-cdn-track` resolves `@shopify/polaris-types` from each document's package up to the root, then from the one version the workspace packages install, and warns whenever it cannot compare (types missing, or several workspace versions). New `polarisCdnPin: "minor"` requires the script to name the types' minor, for example `polaris-2.0.js` with types 2.0.x.
- `shopify-pattern-catalog`, default but silent until `shopifyPattern: { project, components, skill? }` is set: `components.md` names only catalogued entries and existing paths, and every custom component appears in it.
