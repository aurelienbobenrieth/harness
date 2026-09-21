---
"@aurelienbbn/oxlint-plugin-shopify-app": minor
---

Add nine server-side Shopify app rules: `require-mutation-user-errors`, `require-idempotent-mutations` (dated 17-mutation table, `since` option, literal-key detection), `no-swallowed-auth-response`, `no-hardcoded-billing-test-mode`, `webhook-hmac-verification-shape`, `no-router-redirect-in-embedded-route`, the path-scoped `functions-no-unavailable-runtime-apis`, and the opt-in candidates `no-stale-api-version-in-source` and `no-session-or-token-logging`.

`no-script-tag-api` now states the 2027-03-01 Script Tag shutdown with its changelog reference and moves from the Built for Shopify category opt-ins into the documented server and API baseline. Existing configurations that enable it see a new message only.

GraphQL literal parsing is shared and cached across rules, resolves same-document fragments, and treats interpolations inside a mutation field as unknown. The README documents the baseline configuration and warns against applying `require-fetch-abort-signal` to admin UI extensions.
