---
"@aurelienbbn/conformance-shopify-app": minor
---

`compliance-webhooks` gains a `distribution: "public" | "custom"` option (default `"public"`, the previous behavior): `"custom"` skips the check, since only App Store apps must register the privacy compliance topics. `app-bridge-script` accepts a Shopify `AppProvider` import (`@shopify/shopify-app-react-router/react`, `@shopify/shopify-app-remix/react`, `@shopify/app-bridge-react`) as the App Bridge injector, and with no `shopify.app.toml` it reports a warning and skips instead of assuming an embedded app.
