# @aurelienbbn/oxlint-plugin-shopify-app

Custom oxlint rules for Shopify app and extension code. Rules implement static portions of Shopify requirements and Polaris component guidance. Passing lint does not establish App Store or Built for Shopify eligibility.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

## Scoping

Copy the tested [App Home recipe](../../examples/shopify/app-home.oxlintrc.json) into your project and run it over App Home source paths. It combines Polaris contracts with upstream native HTML accessibility rules:

```sh
oxlint --config app-home.oxlintrc.json app
```

Rules do not infer the app category or extension target. Keep this recipe scoped to App Home; checkout and customer-account components have different contracts. Enable additional policies only after selecting the applicable category and source paths:

| Optional rule                     | Scope decision                                                                                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-draft-order-custom-discounts` | Discount-app automation subject to Built for Shopify 5.5.2. Keep merchant-driven draft-order workflows outside this policy.                                                                                                  |
| `no-asset-api-theme-writes`       | App code subject to Built for Shopify 3.2.2 after reviewing its page-builder, backup/restore, SEO, content-locking and developer-tooling exceptions.                                                                         |
| `no-admin-rest-api`               | New public apps subject to the GraphQL-only policy; see migration boundaries below.                                                                                                                                          |
| `require-fetch-abort-signal`      | Explicit checkout extension source directories where cancellation is part of the request policy, such as `extensions/checkout-banner/src/**`. Pair it with runtime deadline evidence; a signal does not establish a timeout. |

Use oxlint `overrides` for those selected paths. A blanket `extensions/**` override cannot distinguish checkout, customer-account, admin, Function and theme surfaces. In particular, keep `require-fetch-abort-signal` off admin UI extensions: a relative `fetch("/api/...")` to the app's own domain is their [documented auto-authenticated path](https://shopify.dev/docs/api/admin-extensions/latest/network-features), and cancellation is a checkout and customer-account request policy. The [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) define category applicability and exceptions.

## Server and API baseline

These rules need no category decision and belong in every Shopify app configuration, scoped to app server and route source:

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-shopify-app"],
  "rules": {
    "shopify-app/no-script-tag-api": "error",
    "shopify-app/require-mutation-user-errors": "error",
    "shopify-app/require-idempotent-mutations": "error",
    "shopify-app/no-swallowed-auth-response": "error",
    "shopify-app/no-hardcoded-billing-test-mode": "error",
    "shopify-app/webhook-hmac-verification-shape": "error",
    "shopify-app/no-router-redirect-in-embedded-route": "warn"
  }
}
```

| Rule                                   | Trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-script-tag-api`                    | `scriptTagCreate`/`scriptTagUpdate` mutations, REST `script_tags` requests and generated Script Tag document imports. Script tags [stop running on 2027-03-01](https://shopify.dev/changelog/online-store-script-tags-deprecation), so the rule is part of the baseline instead of a Built for Shopify category opt-in.                                                                                                                                                                                                                             |
| `require-mutation-user-errors`         | A top-level mutation field in a GraphQL string or template whose selection has no `userErrors` or `*UserErrors` field. Same-document fragments are followed; unknown fragments, interpolations inside the field and unparsable text stay silent. Option `ignoreMutations` lists payloads without the field; use overrides to exclude non-Shopify GraphQL clients.                                                                                                                                                                                   |
| `require-idempotent-mutations`         | One of the 17 refund, inventory and location mutations listed in the [idempotency changelog](https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations) without `@idempotent` on the field (`missingIdempotent`), or with a string-literal key (`literalIdempotencyKey`). The list lives in one dated table in the rule source (published 2025-12-12, reviewed 2026-09-20). Option `since` names the Admin API version the project pins; a value below `2026-04` silences `missingIdempotent` only. |
| `no-swallowed-auth-response`           | `authenticate.admin/webhook/flow/fulfillmentService/pos`, `authenticate.public.*`, `billing.require/request/cancel/updateUsageCappedAmount`, `scopes.request`, or a `redirect` destructured from `authenticate.admin`, inside a `try` of the same function whose `catch` has neither a `throw` nor an `instanceof Response` test.                                                                                                                                                                                                                   |
| `no-hardcoded-billing-test-mode`       | Literal `isTest: true` in the first argument of `billing.require/request/check/cancel/createUsageRecord`, or literal `test: true` on `appSubscriptionCreate`/`appPurchaseOneTimeCreate`. Test and fixture files are skipped.                                                                                                                                                                                                                                                                                                                        |
| `webhook-hmac-verification-shape`      | Only in files containing the `X-Shopify-Hmac-SHA256` header name: `.update(JSON.stringify(...))` on a `createHmac` chain, and `createHmac` without any `timingSafeEqual`/`safeCompare` identifier. Option `safeCompareNames` replaces the accepted names. Verification delegated to another file and OAuth `hmac` query checks stay silent.                                                                                                                                                                                                         |
| `no-router-redirect-in-embedded-route` | A `redirect` imported from `react-router` or `@remix-run/{node,server-runtime,cloudflare}` called in a module that also calls `authenticate.admin`, or called anywhere with an `https://` or `shopify://` destination. Relative redirects usually still work, so configure it as `warn`.                                                                                                                                                                                                                                                            |

Opt-in rules outside the baseline:

| Rule                                    | Trigger and scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions-no-unavailable-runtime-apis` | Async functions, top-level `await`, `.then()` on call results, unshadowed `Promise`, `setTimeout`, `setInterval`, `fetch`, `crypto`, `URL`, `URLSearchParams`, `process`, `Buffer`, `require`, `node:` imports, `Date.now()`, zero-argument `Date`, `Math.random()` and `performance.now()`. Enable it through `overrides` on JavaScript Function source only, such as `extensions/volume-discount/src/**`; every other surface legitimately uses these APIs.                                                                                               |
| `no-stale-api-version-in-source`        | Candidate rule, off by default. `/api/<version>/` in string or template literals, string `apiVersion` properties and `ApiVersion.<Month><YY>` members. Without options it reports only `unstable` outside tests; options `minimumApiVersion` and `maximumApiVersion` add reviewed bounds. No clock-derived verdicts.                                                                                                                                                                                                                                        |
| `no-session-or-token-logging`           | Candidate rule, off by default. `console`, `logger` or `log` calls whose arguments expose `session`, `accessToken`, `access_token`, `sessionToken` or `idToken` (identifier, shorthand, terminal member, spread, template hole or `JSON.stringify`), or a `payload` destructured from `authenticate.webhook`. Options `loggerObjects`, `sensitiveNames` and `webhookPayloadNames` replace the defaults. The detector is domain-neutral apart from the webhook payload hook, so it can move to a core secrets-in-logs rule; prefer that rule once it exists. |

## Autofix

No rule is autofixable: changes require choosing an API, content, layout, or runtime policy.

## Contract boundaries and migration

GraphQL restrictions inspect parsed mutation fields. Draft-order response selections mentioning appliedDiscount do not constitute discount inputs; variable-supplied mutation inputs still need boundary review. REST Asset API GETs are allowed, while recognized write methods are reported. Script Tag imports are scoped to generated/admin sources, and incidental URL strings are not API calls.

Fetch cancellation requires an explicit usable signal shape or a recognized Request-owned signal. Unknown options variables and later overriding spreads are not treated as proof; a signal alone is not a deadline. Modal slots must use allowed action slots and headings must be nonempty. Viewport policy permits maximum-scale values of at least five and rejects user-scalable=no/0. These static checks do not certify Built for Shopify acceptance.

Enable `shopify-app/no-admin-rest-api` for new public apps subject to Shopify's GraphQL-only policy. It recognizes runtime REST resource imports from `@shopify/shopify-api/rest/admin`, dynamic imports and unshadowed `require`, plus unshadowed global `fetch` calls with recognizable REST Admin URLs. GraphQL, Storefront/Ajax APIs, type-only imports, unrelated hosts and shadowed functions remain allowed. SDK instances, wrappers, dynamically selected API versions and resource names require review. Existing public apps and custom apps need an explicit migration decision before enabling this rule.

The new Polaris contracts target App Home v1.0 JSX. They inspect intrinsic elements, static literals and inline object spreads in effective override order. Runtime expressions, later unknown spreads, translated strings and custom component output remain review inputs; a silent diagnostic is not proof of their rendered state. Labels reject known null, boolean and empty values. Fields use `label`; switch and drop zone can use their documented `accessibilityLabel` alternative. Hiding a field label with `labelAccessibilityVisibility=exclusive` does not remove its need for a name. Button and clickable rules inspect direct content, including fragments; icon elements and empty literals do not name an action. Other nested elements and user components need rendered accessibility checks.

`s-action-slot-contract` checks unconditional direct page/modal children, including fragments. A primary slot accepts one `s-button` with `variant=primary`; secondary slots accept secondary/auto buttons, with button groups also accepted on pages. Conditional rendering, wrappers and group contents still need review. `s-page-aside-visible` reports an aside rendered directly under a page whose explicit width is small or large. `s-button-submit-no-navigation` catches static navigation or command props that override submit/reset behavior. `s-tooltip-no-interactive-content` checks unconditional intrinsic descendants, stopping at user component boundaries. `s-money-field-no-currency-symbol` recognizes Unicode currency symbols in literal labels/placeholders; it does not inspect translations or financial arithmetic.

## Attribution and source boundaries

These rules independently implement concepts from Shopify's [REST Admin migration policy](https://shopify.dev/docs/api/admin-rest), Polaris [Button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button), [Clickable](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable), [Spinner](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner), [form components](https://shopify.dev/docs/api/app-home/latest/web-components#forms), [Page](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page), [Modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal), [Tooltip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip), and [Money field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field) documentation, reviewed on 2026-09-05. The server and API rules independently implement concepts from Shopify's [Admin GraphQL reference](https://shopify.dev/docs/api/admin-graphql/latest), [idempotency changelog](https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations) and [idempotency guide](https://shopify.dev/docs/api/usage/implementing-idempotency), the control flow of [`shopify-app-js`](https://github.com/Shopify/shopify-app-js), the [React Router app template](https://github.com/Shopify/shopify-app-template-react-router) guidance, the [billing API reference](https://shopify.dev/docs/api/shopify-app-react-router/latest/apis/billing), [webhook HTTPS delivery](https://shopify.dev/docs/apps/build/webhooks/subscribe/https), [JavaScript for Functions](https://shopify.dev/docs/apps/build/functions/programming-languages/javascript-for-functions) and [Function input/output limits](https://shopify.dev/docs/apps/build/functions/input-output), [API versioning](https://shopify.dev/docs/api/usage/versioning), [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data) and the [Script Tag deprecation changelog](https://shopify.dev/changelog/online-store-script-tags-deprecation), reviewed on 2026-09-20. Source code carries greppable `@attribution` tags. No source implementation or prose is vendored.

Native HTML accessibility belongs in upstream `jsx-a11y` rules. Polaris property unions belong in Shopify's component types. Visual contrast, attention, copy quality, keyboard behavior, responsive layout and runtime API behavior need semantic review or browser/runtime evidence. The source audit found conflicting Page breadcrumb and Select option-content guidance; no blanket restriction was added for those cases. See the [component research record](../../docs/reviews/2026-09-05-shopify-ast-research.md).

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                              | Trigger or review scope                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions-no-unavailable-runtime-apis` | Disallow async code, timers, fetch, crypto, URL, process, Buffer, require, node: imports, and clock or random reads in Shopify Function source; scope it to Function directories with overrides.                              |
| `no-admin-rest-api`                     | Disallow Shopify REST Admin resource imports and unshadowed fetch calls to recognizable REST Admin endpoints; enable for new public apps.                                                                                     |
| `no-asset-api-theme-writes`             | Disallow theme file writes through the Asset API or theme file mutations.                                                                                                                                                     |
| `no-draft-order-custom-discounts`       | Disallow draft order mutations that apply custom discounts.                                                                                                                                                                   |
| `no-hardcoded-billing-test-mode`        | Disallow literal `isTest: true` in billing.* calls and literal `test: true` on appSubscriptionCreate/appPurchaseOneTimeCreate outside test files, because test charges never bill the merchant.                               |
| `no-nav-emoji`                          | Disallow emoji inside app navigation labels. Option `navComponents` overrides the checked element names.                                                                                                                      |
| `no-router-redirect-in-embedded-route`  | Prefer the redirect helper returned by authenticate.admin over the router's redirect in modules that authenticate admin requests, and always for https:// or shopify:// destinations.                                         |
| `no-script-tag-api`                     | Disallow the Script Tag API, which stops running on 2027-03-01, in favor of Web Pixel and theme app extensions.                                                                                                               |
| `no-session-or-token-logging`           | Disallow passing session objects, access or session tokens, or an authenticate.webhook payload to console/logger calls. Options `loggerObjects`, `sensitiveNames` and `webhookPayloadNames` override the matched names.       |
| `no-stale-api-version-in-source`        | Disallow Shopify API versions in URLs, `apiVersion` properties and `ApiVersion.*` members that are `unstable` or outside the configured `minimumApiVersion`/`maximumApiVersion` bounds.                                       |
| `no-swallowed-auth-response`            | Disallow authenticate.*, billing.require/request/cancel/updateUsageCappedAmount, scopes.request and the embedded redirect helper inside a try whose catch never rethrows, because they throw a Response as control flow.      |
| `no-viewport-zoom-disable`              | Disallow viewport meta tags that block pinch zoom.                                                                                                                                                                            |
| `require-fetch-abort-signal`            | Require fetch calls (direct or window/globalThis/self qualified) to pass an AbortSignal.                                                                                                                                      |
| `require-idempotent-mutations`          | Require @idempotent(key: $variable) on the 17 inventory, refund and location mutations that reject calls without it from Admin API 2026-04, and disallow literal keys. Option `since` names the API version the project pins. |
| `require-mutation-user-errors`          | Require every GraphQL mutation field to select userErrors (or a *UserErrors field). Option `ignoreMutations` lists mutation names without such a payload field.                                                               |
| `s-action-slot-contract`                | Validate statically assigned Polaris page/modal action slot element types, variants, and single-primary cardinality.                                                                                                          |
| `s-button-accessible-name`              | Require an accessibilityLabel on statically unnamed Polaris buttons, including icon-only buttons.                                                                                                                             |
| `s-button-submit-no-navigation`         | Disallow static href or commandFor values that override a Polaris button's submit or reset behavior.                                                                                                                          |
| `s-clickable-accessible-name`           | Require accessibilityLabel on Polaris clickable components without statically readable content.                                                                                                                               |
| `s-form-control-label-required`         | Require labels on Polaris form fields; switch and drop zone may use their documented accessibilityLabel alternative.                                                                                                          |
| `s-modal-actions-use-slots`             | Require modal action buttons to use the modal action slots. Options `components` and `actionElements` override the checked element names.                                                                                     |
| `s-modal-heading-required`              | Require a heading attribute on modal elements. Option `components` overrides the checked element names.                                                                                                                       |
| `s-money-field-no-currency-symbol`      | Disallow literal currency symbols in Polaris money-field labels and placeholders, whose currency formatting is component-owned.                                                                                               |
| `s-page-aside-visible`                  | Disallow s-page aside content when an explicit small or large inlineSize prevents it from rendering.                                                                                                                          |
| `s-spinner-accessible-label`            | Require a nonempty accessibilityLabel on Polaris spinners.                                                                                                                                                                    |
| `s-tooltip-no-interactive-content`      | Disallow statically interactive intrinsic descendants inside Polaris tooltips; custom component and conditional output require review.                                                                                        |
| `webhook-hmac-verification-shape`       | In files reading the X-Shopify-Hmac-SHA256 header, disallow hashing JSON.stringify output and require a timing-safe comparison. Option `safeCompareNames` overrides the accepted comparison identifiers.                      |

### Credited concepts

- https://github.com/Shopify/shopify-app-js (inspiration; independently implemented)
- https://github.com/Shopify/shopify-app-template-react-router (inspiration; independently implemented)
- https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations (inspiration; independently implemented)
- https://shopify.dev/changelog/online-store-script-tags-deprecation (inspiration; independently implemented)
- https://shopify.dev/docs/api/admin-graphql/latest (inspiration; independently implemented)
- https://shopify.dev/docs/api/admin-rest (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/actions/button (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-type (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page#slots (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page#slots-slotdetail-aside (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal#slots (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip (inspiration; independently implemented)
- https://shopify.dev/docs/api/shopify-app-react-router/latest/apis/billing (inspiration; independently implemented)
- https://shopify.dev/docs/api/usage/implementing-idempotency (inspiration; independently implemented)
- https://shopify.dev/docs/api/usage/versioning (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/functions/input-output (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/functions/programming-languages/javascript-for-functions (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/webhooks/subscribe/https (inspiration; independently implemented)
- https://shopify.dev/docs/apps/launch/protected-customer-data (inspiration; independently implemented)

<!-- harness-catalog:end -->
