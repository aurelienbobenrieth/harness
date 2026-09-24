# @aurelienbbn/oxlint-plugin-shopify-app

**27 oxlint rules for Shopify apps and extensions: the static slice of App Store, Built for Shopify, Admin API, and Polaris App Home requirements.**

> [!WARNING]
> **Passing lint doesn't make an app App Store or Built for Shopify eligible.** These rules implement the statically checkable parts only.

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-shopify-app oxlint   # oxlint >=1.82.0 <2.0.0
```

No preset, **no autofix**: every change means choosing an API, content, layout, or runtime policy.

## 27 rules, 4 scopes

```text
server baseline   ███████          7   every app, server + route source
App Home recipe   █████████████   13   + 14 jsx-a11y, App Home paths only
category opt-in   ████             4   overrides on the paths the BFS category covers
other opt-in      ███              3   Function source · 2 candidates, off by default
```

**Rules never infer the app category or extension target.** You decide, then scope with `overrides`.

## Server baseline: every app, no decision needed

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

```ts
`mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } } }`; // ❌ no userErrors
`mutation { tagsAdd(id: 1, tags: []) { node { id } userErrors { field message } } }`; // ✅

`mutation($input: RefundInput!) { refundCreate(input: $input) { refund { id } userErrors { message } } }`; // ❌ missingIdempotent
`mutation($input: RefundInput!) { refundCreate(input: $input) @idempotent(key: "4f5b6ebf-143c-4da5-8d0f-fb8553bfd85d") { refund { id } } }`; // ❌ literalIdempotencyKey
`mutation($input: RefundInput!, $key: String!) { refundCreate(input: $input) @idempotent(key: $key) { refund { id } } }`; // ✅

try {
  const { admin } = await authenticate.admin(request);
  return admin;
} catch (error) {
  return data({ error: "Something went wrong" }, { status: 500 });
} // ❌ swallows the Response
try {
  await authenticate.admin(request);
} catch (error) {
  if (error instanceof Response) throw error;
  return null;
} // ✅

await billing.require({ plans: [PRO], isTest: true, onFailure }); // ❌ never bills
```

**Idempotency list: one dated table in the rule source.** Published 2025-12-12, reviewed 2026-09-20, required from Admin API `2026-04`. Script tags [stop running on 2027-03-01](https://shopify.dev/changelog/online-store-script-tags-deprecation): baseline, not a BFS opt-in.

<details>
<summary>Exact triggers, silent cases, options</summary>

| Rule                                             | ❌ Fires on                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-script-tag-api`                              | `scriptTagCreate` / `scriptTagUpdate` mutations, REST `script_tags` requests, generated Script Tag document imports                                                                                                                                                                                                                                                        |
| `require-mutation-user-errors`                   | a top-level mutation field in a GraphQL string or template whose selection has no `userErrors` / `*UserErrors` field                                                                                                                                                                                                                                                       |
| `require-idempotent-mutations`                   | one of the 17 refund, inventory and location mutations in the [idempotency changelog](https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations) without `@idempotent` (`missingIdempotent`), or with a string-literal key (`literalIdempotencyKey`)                                                                       |
| `no-swallowed-auth-response`                     | `authenticate.admin/webhook/flow/fulfillmentService/pos`, `authenticate.public.*`, `billing.require/request/cancel/updateUsageCappedAmount`, `scopes.request`, or a `redirect` destructured from `authenticate.admin`, inside a `try` of the same function whose `catch` has neither a `throw` nor an `instanceof Response` test. These throw a `Response` as control flow |
| `no-hardcoded-billing-test-mode`                 | literal `isTest: true` in the first argument of `billing.require/request/check/cancel/createUsageRecord`, or literal `test: true` on `appSubscriptionCreate` / `appPurchaseOneTimeCreate`                                                                                                                                                                                  |
| `webhook-hmac-verification-shape`                | in files containing the `X-Shopify-Hmac-SHA256` header name only: `.update(JSON.stringify(...))` on a `createHmac` chain; `createHmac` without any `timingSafeEqual` / `safeCompare` identifier                                                                                                                                                                            |
| `no-router-redirect-in-embedded-route` ⚠️ `warn` | `redirect` from `react-router` or `@remix-run/{node,server-runtime,cloudflare}` called in a module that also calls `authenticate.admin`, or anywhere with an `https://` or `shopify://` destination. Relative redirects usually still work, hence `warn`                                                                                                                   |

| Rule                              | ⏭️ Silent on                                                                                              | Option (default)                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `require-mutation-user-errors`    | unknown fragments, interpolations inside the field, unparsable text. Same-document fragments are followed | `ignoreMutations` (`[]`): payloads without the field. Exclude non-Shopify GraphQL clients via `overrides`             |
| `require-idempotent-mutations`    | —                                                                                                         | `since` (unset): the Admin API version you pin, `YYYY-01/04/07/10`. Below `2026-04` silences `missingIdempotent` only |
| `no-hardcoded-billing-test-mode`  | test and fixture files                                                                                    | —                                                                                                                     |
| `webhook-hmac-verification-shape` | verification delegated to another file; OAuth `hmac` query checks                                         | `safeCompareNames` (`["timingSafeEqual", "safeCompare"]`), replaced not merged                                        |

The 17 mutations needing `@idempotent`: `refundCreate` · `inventoryShipmentReceive` · `inventoryAdjustQuantities` · `inventoryMoveQuantities` · `inventorySetQuantities` · `inventorySetOnHandQuantities` · `inventoryShipmentCreateInTransit` · `inventoryShipmentCreate` · `inventoryTransferCreate` · `inventoryTransferCreateAsReadyToShip` · `inventoryTransferDuplicate` · `inventoryTransferSetItems` · `inventorySetScheduledChanges` · `inventoryActivate` · `inventoryShipmentAddItems` · `locationActivate` · `locationDeactivate`

</details>

## App Home recipe: Polaris + native a11y

Copy the tested [App Home recipe](../../examples/shopify/app-home.oxlintrc.json); run it on App Home source only:

```sh
oxlint --config app-home.oxlintrc.json app
```

```text
app-home.oxlintrc.json
├── jsx-a11y (14 upstream rules)   native HTML accessibility
└── shopify-app (13 rules)         Polaris App Home v1.0 contracts
      no-nav-emoji · no-viewport-zoom-disable · s-action-slot-contract
      s-button-accessible-name · s-button-submit-no-navigation · s-clickable-accessible-name
      s-form-control-label-required · s-modal-actions-use-slots · s-modal-heading-required
      s-money-field-no-currency-symbol (warn) · s-page-aside-visible
      s-spinner-accessible-label · s-tooltip-no-interactive-content
```

**Keep this recipe on App Home.** Checkout and customer-account components have different contracts.

```tsx
<s-button icon="edit" />                                     // ❌ s-button-accessible-name
<s-button icon="edit" accessibilityLabel="Edit product" />   // ✅

<s-text-field labelAccessibilityVisibility="exclusive" />        // ❌ hiding the label doesn't remove the need for one
<s-search-field label="Search" labelAccessibilityVisibility="exclusive" /> // ✅

<s-money-field label="Price ($)" />                              // ❌ currency formatting is component-owned
```

**Static only: a silent diagnostic is not proof of the rendered state.**

<details>
<summary>Per-rule contracts and what static checks miss</summary>

| Rule                                                      | Contract                                                                                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s-action-slot-contract`                                  | unconditional direct page/modal children, fragments included. `primary-action`: one `s-button` with `variant=primary`. Secondary slots: secondary/auto buttons; pages also accept button groups |
| `s-modal-actions-use-slots`                               | modal action buttons use the modal action slots. Options `components` (`["s-modal"]`), `actionElements` (`["s-button", "button"]`)                                                              |
| `s-modal-heading-required`                                | nonempty `heading` on modals. Option `components` (`["s-modal"]`)                                                                                                                               |
| `s-page-aside-visible`                                    | an aside rendered directly under a page whose explicit `inlineSize` is small or large (it won't render)                                                                                         |
| `s-button-submit-no-navigation`                           | static `href` / `commandFor` that override submit/reset behavior                                                                                                                                |
| `s-button-accessible-name`, `s-clickable-accessible-name` | direct content, fragments included; icon elements and empty literals don't name an action                                                                                                       |
| `s-form-control-label-required`                           | fields use `label`; switch and drop zone may use their documented `accessibilityLabel` instead. Known `null`, boolean and empty values are rejected                                             |
| `s-spinner-accessible-label`                              | nonempty `accessibilityLabel`                                                                                                                                                                   |
| `s-tooltip-no-interactive-content`                        | unconditional intrinsic descendants; stops at user component boundaries                                                                                                                         |
| `s-money-field-no-currency-symbol`                        | Unicode currency symbols in literal labels/placeholders. Doesn't inspect translations or financial arithmetic                                                                                   |
| `no-viewport-zoom-disable`                                | `maximum-scale` below 5, `user-scalable=no` / `0`                                                                                                                                               |
| `no-nav-emoji`                                            | emoji in nav labels. Option `navComponents` (`["s-app-nav", "ui-nav-menu"]`)                                                                                                                    |

Rules read intrinsic elements, static literals, and inline object spreads in effective override order.

| ✅ Checked                                          | ⚠️ Still needs review or rendered checks                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| intrinsic elements, static literals, inline spreads | runtime expressions, later unknown spreads, translated strings, custom component output        |
| direct children and fragments                       | conditional rendering, wrappers, button-group contents, other nested elements, user components |

</details>

## Category opt-ins: decide first

| Rule                              | Turn it on for                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-draft-order-custom-discounts` | discount-app automation under Built for Shopify 5.5.2. Keep merchant-driven draft-order workflows outside it                                    |
| `no-asset-api-theme-writes`       | app code under Built for Shopify 3.2.2, after reviewing its page-builder, backup/restore, SEO, content-locking and developer-tooling exceptions |
| `no-admin-rest-api`               | new public apps under the GraphQL-only policy. **Existing public and custom apps: explicit migration decision first**                           |
| `require-fetch-abort-signal`      | explicit checkout extension dirs where cancellation is request policy. Pair it with runtime deadline evidence: **a signal isn't a timeout**     |

> [!WARNING]
> **Never scope with a blanket `extensions/**`:** it can't tell checkout, customer-account, admin, Function and theme surfaces apart.

<details>
<summary>Admin extensions, allowed vs reported, <code>no-admin-rest-api</code> scope</summary>

Keep `require-fetch-abort-signal` off admin UI extensions: a relative `fetch("/api/...")` to the app's own domain is their [documented auto-authenticated path](https://shopify.dev/docs/api/admin-extensions/latest/network-features); cancellation is a checkout and customer-account policy. Category applicability and exceptions: [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements).

| Rule                              | ✅ Allowed                                                           | ❌ Reported                                                              | ⚠️ Review input                                                     |
| --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `no-draft-order-custom-discounts` | response selections mentioning `appliedDiscount` (not an input)      | draft-order mutations applying custom discounts (parsed mutation fields) | variable-supplied mutation inputs                                   |
| `no-asset-api-theme-writes`       | REST Asset API `GET`                                                 | recognized write methods; theme file mutations                           | —                                                                   |
| `require-fetch-abort-signal`      | an explicit usable signal shape; a recognized `Request`-owned signal | `fetch` (direct or `window` / `globalThis` / `self`) without one         | unknown options variables and later overriding spreads aren't proof |

`no-admin-rest-api`:

| ❌ Reports                                                                                                  | ✅ Allowed                                       | ⚠️ Needs review                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| runtime REST resource imports from `@shopify/shopify-api/rest/admin`, dynamic imports, unshadowed `require` | GraphQL, Storefront/Ajax APIs, type-only imports | SDK instances, wrappers                              |
| unshadowed global `fetch` with a recognizable REST Admin URL                                                | unrelated hosts, shadowed functions              | dynamically selected API versions and resource names |

</details>

## Other opt-ins

`functions-no-unavailable-runtime-apis` on **JS Function source only**. 🧪 `no-stale-api-version-in-source` and `no-session-or-token-logging` are candidates, off by default.

<details>
<summary>Triggers and options</summary>

| Rule                                    | Status                                                                                | ❌ Fires on                                                                                                                                                                                                                                                                         | Options (default)                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions-no-unavailable-runtime-apis` | opt-in, **JS Function source only**; every other surface uses these APIs legitimately | async functions, top-level `await`, `.then()` on call results, unshadowed `Promise`, `setTimeout`, `setInterval`, `fetch`, `crypto`, `URL`, `URLSearchParams`, `process`, `Buffer`, `require`, `node:` imports, `Date.now()`, zero-arg `Date`, `Math.random()`, `performance.now()` | —                                                                                                                                                 |
| `no-stale-api-version-in-source`        | 🧪 candidate, off by default                                                          | `/api/<version>/` in string/template literals, string `apiVersion` properties, `ApiVersion.<Month><YY>` members. No options → only `unstable` outside tests. No clock-derived verdicts                                                                                              | `minimumApiVersion`, `maximumApiVersion` (unset): reviewed bounds                                                                                 |
| `no-session-or-token-logging`           | 🧪 candidate, off by default                                                          | `console` / `logger` / `log` calls exposing `session`, `accessToken`, `access_token`, `sessionToken`, `idToken` (identifier, shorthand, terminal member, spread, template hole, `JSON.stringify`), or a `payload` destructured from `authenticate.webhook`                          | `loggerObjects` (`["console", "logger", "log"]`), `sensitiveNames` (the 5 above), `webhookPayloadNames` (`["payload"]`), each replaced not merged |

`no-session-or-token-logging` is domain-neutral apart from the webhook payload hook: **prefer a core secrets-in-logs rule once one exists.**

</details>

<details>
<summary>Out of scope, and who owns it</summary>

| Concern                                                                                       | Owner                                                                              |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| native HTML accessibility                                                                     | upstream `jsx-a11y` rules                                                          |
| Polaris property unions                                                                       | Shopify's component types                                                          |
| contrast, attention, copy quality, keyboard behavior, responsive layout, runtime API behavior | semantic review or browser/runtime evidence                                        |
| Page breadcrumbs, Select option content                                                       | ❌ no blanket rule: Shopify's guidance conflicts                                   |
| Script Tag scope                                                                              | imports scoped to generated/admin sources; incidental URL strings aren't API calls |

</details>

**Every rule independently implements Shopify documentation concepts; source carries greppable `@attribution` tags; no implementation or prose vendored.**

<details>
<summary>Sources, by review date</summary>

| Reviewed                  | Sources                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-05 · Polaris      | [REST Admin migration policy](https://shopify.dev/docs/api/admin-rest), [Button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button), [Clickable](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable), [Spinner](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner), [form components](https://shopify.dev/docs/api/app-home/latest/web-components#forms), [Page](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page), [Modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal), [Tooltip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip), [Money field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field)                                                                                                                                                                                                                                                                                                           |
| 2026-09-20 · server & API | [Admin GraphQL reference](https://shopify.dev/docs/api/admin-graphql/latest), [idempotency changelog](https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations), [idempotency guide](https://shopify.dev/docs/api/usage/implementing-idempotency), control flow of [`shopify-app-js`](https://github.com/Shopify/shopify-app-js), [React Router app template](https://github.com/Shopify/shopify-app-template-react-router), [billing API reference](https://shopify.dev/docs/api/shopify-app-react-router/latest/apis/billing), [webhook HTTPS delivery](https://shopify.dev/docs/apps/build/webhooks/subscribe/https), [JavaScript for Functions](https://shopify.dev/docs/apps/build/functions/programming-languages/javascript-for-functions), [Function input/output limits](https://shopify.dev/docs/apps/build/functions/input-output), [API versioning](https://shopify.dev/docs/api/usage/versioning), [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data), [Script Tag deprecation changelog](https://shopify.dev/changelog/online-store-script-tags-deprecation) |

</details>

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
