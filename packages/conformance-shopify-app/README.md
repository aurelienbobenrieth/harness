# @aurelienbbn/conformance-shopify-app

**10 static checks for Shopify app repos, plus 4 evaluators for evidence you supply.**

```text
 repo on disk ─────▶ shopifyAppChecks (9 default + 1 opt-in) ─▶ findings[]   Vitest or plain function
 Response / handler ▶ evaluateShopifyIframeProtection          ─▶ findings[]   called from your tests
                      probeShopifyWebhookHmac
 metrics JSON ──────▶ evaluateShopifyPerformance               ─▶ passed | failed | incomplete
                      evaluateShopifyStorefrontPerformance
```

> [!WARNING]
> **A static preflight, not Shopify approval.** Shopify's review and deployment systems stay authoritative.

## One file, nine tests

```ts
// conformance.test.ts
import { shopifyAppConformance } from "@aurelienbbn/conformance-shopify-app/vitest";

shopifyAppConformance({ root: process.cwd() });
```

**Errors fail; warnings print and never fail the suite.** `vitest` is an optional peer; Node `^22.19.0 || ^24.11.0`.

```ts
import { runShopifyAppConformance, runShopifyAppConformanceReport } from "@aurelienbbn/conformance-shopify-app";

const findings = await runShopifyAppConformance({ root: process.cwd() });
const report = await runShopifyAppConformanceReport({ root: process.cwd() }); // { appManifests, findings }
```

- Findings: `check`, `severity` (`error` | `warning`), `message`, optional `path`, the justifying shopify.dev `docs` URL.
- `appManifests` in the report names the deployment scope.
- Optional second argument everywhere: a check list replacing `shopifyAppChecks`.

## What a run catches

```text
appManifests: [shopify.app.toml]          (minimumApiVersion: "2025-10", messages trimmed)

❌ compliance-webhooks   shopify.app.toml   must declare compliance topic "customers/data_request" in webhooks.subscriptions with a nonempty uri…
❌ compliance-webhooks   shopify.app.toml   … "customers/redact" …
❌ compliance-webhooks   shopify.app.toml   … "shop/redact" …
❌ app-bridge-script     app/root.tsx       Load https://cdn.shopify.com/shopifycloud/app-bridge.js as the first script in this document head…
❌ app-url-security      shopify.app.toml   application_url: Set an absolute HTTPS URL without embedded credentials…
❌ api-version-contract  shopify.app.toml   webhooks.api_version: Version 2025-07 is below the configured minimum 2025-10…
⚠️ api-version-contract  app/shopify.server.ts  apiVersion: The app server requests Admin API 2025-10 while shopify.app.toml delivers webhooks at 2025-07…
```

## Checks

| Check                           | Missing evidence                                | Does not prove                      |
| ------------------------------- | ----------------------------------------------- | ----------------------------------- |
| `compliance-webhooks`           | ⚠️ no manifest · ❌ selected missing / bad TOML | delivery, legal compliance          |
| `app-bridge-script`             | ⚠️ no document found · ❌ explicit one missing  | generated markup, route coverage    |
| `functions-localization`        | ❌ 0 or 2+ default locales, bad JSON            | translation quality                 |
| `checkout-bundle-size`          | ❌ no built JavaScript                          | compressed size, CLI acceptance     |
| `app-url-security`              | ❌ missing / bad manifest                       | TLS certificates, reachability      |
| `webhook-subscription-contract` | ❌ missing / bad manifest                       | cloud resources, signatures         |
| `api-version-contract`          | ❌ explicit `serverEntries` match nothing       | current version availability        |
| `built-for-shopify-extensions`  | silent when unset                               | functionality, category eligibility |
| `listing-inputs`                | silent when unset; `{}` proves nothing          | meaning, image quality              |
| `extension-capability-contract` | 🔒 opt-in, see below                            | runtime failure                     |

```ts
import { optionalShopifyAppChecks, shopifyAppChecks } from "@aurelienbbn/conformance-shopify-app";

shopifyAppConformance({ root: process.cwd() }, [...shopifyAppChecks, ...optionalShopifyAppChecks]);
```

<details>
<summary>Per-check rules, discovery, and limits</summary>

### compliance-webhooks

Checks the [App Store compliance-topic contract](https://shopify.dev/docs/apps/build/webhooks/subscribe) under `webhooks.subscriptions`, each with a nonempty `uri`. **Each deployment manifest holds its own topics: no pooling across environments.** Source mentions and unrelated tables register nothing. Also unproven: processing.

### app-bridge-script

Every selected embedded document loads `https://cdn.shopify.com/shopifycloud/app-bridge.js` as its first `<head>` script (comments ignored). Skipped when every selected manifest sets `embedded = false`.

| Option            | Default                                                                     | Rule                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `documentEntries` | discover `index.html`, `root.tsx/jsx`, `__root.tsx/jsx` up to 4 levels deep | project-relative; empty list or path outside the project throws; use when served documents differ or the repo ships unused examples |
| `platformMarkers` | none accepted                                                               | explicit integration exception, **not proof of served markup**; empty markers throw                                                 |

Static JSX/HTML inspection cannot establish generated markup, script execution, or coverage of routes the caller omits.

### functions-localization

Function extensions whose actual `name` or effective `description` starts with `t:` ship `locales/` with exactly one `<lang>.default.json`; keys resolve to owned string properties. Missing key: ❌ in the default locale, ⚠️ in others.

### checkout-bundle-size

`ui_extension` entries whose `targeting` includes `purchase.checkout.*`. Sums every `.js` under that extension's `dist/`, recursively (≤ 10 levels): a conservative raw-byte total, not an entry graph or compressed transfer. `checkoutBundleLimitKb`: default `64`, must be `> 0` and `≤ 64` (stricter only), else throws. Shopify CLI decides deployment acceptance.

### app-url-security

| Field                                                         | Rule                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `application_url`                                             | absolute HTTPS, no credentials                                                 |
| `auth.redirect_urls`                                          | when `[auth]` exists: nonempty array, each HTTPS                               |
| `customer_authentication.redirect_uris`                       | when the table exists: nonempty HTTPS array                                    |
| `customer_authentication.logout_urls` · `.javascript_origins` | when present: nonempty HTTPS arrays; origins carry no path, query, or fragment |

No OAuth table required for apps using another installation contract.

### webhook-subscription-contract

Actual `[[webhooks.subscriptions]]` array tables need nonempty `topics` / `compliance_topics` (compliance limited to the three privacy topics) and a delivery URI: `https://…` (no fragment or credentials), root-relative `/webhooks/…` (no fragment), `pubsub://project:topic`, or a Shopify EventBridge ARN. Anything else ❌. Also unproven: processing, legal compliance.

### api-version-contract

**No lifecycle deadline guessed from the system clock; a date-shaped version is not evidence of availability.**

| Bounds set                                     | `YYYY-01/04/07/10` | `unstable` | out of range |
| ---------------------------------------------- | ------------------ | ---------- | ------------ |
| neither                                        | ✅ syntax only     | ⚠️ warning | —            |
| `minimumApiVersion` and/or `maximumApiVersion` | ✅                 | ❌ error   | ❌ error     |

- Bounds must be ordered quarterly versions, else throws.
- Webhook and versioned extension manifests: each extension's override applies over the root default; `ui_extension` / `function` entries must resolve to a version.
- The literal `apiVersion` in the server module (`serverEntries`, default `shopify.server.*` at root, `app/`, `src/`) meets the same syntax and bounds. ⚠️ when it differs from a selected manifest's `[webhooks] api_version`: webhook payloads and Admin queries would follow different schemas.
- `"2026-07"` and `ApiVersion.July26` read as `2026-07`; `"unstable"` / `ApiVersion.Unstable` as `unstable`; `LATEST_API_VERSION` and other dynamic values stay silent.

### built-for-shopify-extensions

Opt-in via `builtForShopifyCategories`; unknown categories throw. **Partial structural coverage: presence is only a prerequisite.** Evaluated per deployment: one environment cannot supply another's extension.

| Category                                                      | Requires                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `product-reviews`                                             | Flow trigger + `admin.customer-details.block.render`                                                            |
| `invoices`                                                    | `admin.order-details.print-action.render` + `admin.order-index.selection-print-action.render`                   |
| `advertising` · `email-marketing` · `forms` · `sms-marketing` | segment action `admin.customer-segment-details.action.render`                                                   |
| `subscriptions`                                               | a `customer-account.*.render` target + a theme app block whose literal section schema permits product templates |

A literal Liquid schema is only a prerequisite: Theme Check and a served product-page review remain necessary.

### extension-capability-contract (opt-in)

`optionalShopifyAppChecks`: exported and catalogued, excluded from `shopifyAppChecks` and every default. For UI extensions targeting `purchase.*` or `customer-account.*`, source under `src/` must match `[extensions.capabilities]`:

| Source uses                                                                                 | Requires                |
| ------------------------------------------------------------------------------------------- | ----------------------- |
| `fetch()`                                                                                   | `network_access = true` |
| Storefront `query`: `shopify.query`, `useApi().query`, `query` destructured from `useApi()` | `api_access = true`     |
| `useBuyerJourneyIntercept`, `buyerJourney.intercept`                                        | `block_progress = true` |

- A missing declaration is a ❌ source/manifest mismatch. Shopify's [capabilities documentation](https://shopify.dev/docs/apps/build/checkout/capabilities) states the requirement; runtime behavior without it was not verified on a dev store, so **the finding claims no runtime failure**.
- `block_progress` with extension `api_version` ≥ `2026-07` → ⚠️ citing the [deprecation notice](https://shopify.dev/changelog/deprecating-the-usebuyerjourneyintercept-api-on-checkout-ui-extensions).
- Lexical scan of `.ts .tsx .js .jsx .mjs` up to 10 levels under `src/`; skips `*.test.*`, `*.spec.*`, `.d.ts`, comments, quoted strings, and files that bind or import their own `fetch`. Wrappers, re-exports, and code outside `src/` are not followed.
- Admin extensions skipped: app-domain `fetch` needs no capability.
- Declared-but-unused capabilities not reported: shared packages outside the extension can own the call.

### Which manifests get read

```text
appManifest set?
 ├─ yes ─▶ exactly that root file ── missing = ❌ error · invalid selector = throws
 └─ no ──▶ every root shopify.app.toml / shopify.app.<env>.toml
             <env> = ASCII letters, digits, -, _
             shopify.app.prod.backup.toml ─▶ ignored (rejected as explicit selector)
```

`appManifest` scopes webhook and embedded-App-Bridge ownership to one deployment. App configuration is parsed as TOML.

### Which extensions get read

```text
selected manifest
 └─ extension_directories   (missing or empty ─▶ ["extensions/*"])
     └─ each pattern ─▶ <pattern>/*.extension.toml, immediately inside
                          recursion only with an explicit **
```

- Follows the reviewed Shopify CLI behavior: nested examples cannot satisfy prerequisites by accident.
- Alternate manifest basenames supported. Dependency manifests (`node_modules`) excluded; explicitly selected directories named `dist` stay eligible.
- Paths outside the project, negated or absolute patterns, invalid TOML → ❌.
- Unified `[[extensions]]` files and standalone root extension tables both supported.
- Contracts activate only from real fields (function names/descriptions, `ui_extension` targeting), never from names or targets in unrelated settings.

</details>

## Options

| Option                                    | Default                                                            | Used by                        |
| ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| `root`                                    | required                                                           | all                            |
| `appManifest`                             | every CLI-compatible root manifest                                 | all manifest checks            |
| `documentEntries`                         | discovered layouts                                                 | `app-bridge-script`            |
| `platformMarkers`                         | `[]`                                                               | `app-bridge-script`            |
| `checkoutBundleLimitKb`                   | `64`                                                               | `checkout-bundle-size`         |
| `minimumApiVersion` · `maximumApiVersion` | unset (syntax only)                                                | `api-version-contract`         |
| `serverEntries`                           | `shopify.server.*`, `app/shopify.server.*`, `src/shopify.server.*` | `api-version-contract`         |
| `builtForShopifyCategories`               | `[]`                                                               | `built-for-shopify-extensions` |
| `listing`                                 | unset                                                              | `listing-inputs`               |

```ts
const findings = await runShopifyAppConformance({
  root: process.cwd(),
  appManifest: "shopify.app.production.toml",
  documentEntries: ["index.html"],
  minimumApiVersion: "2025-10",
  maximumApiVersion: "2026-07",
  builtForShopifyCategories: ["product-reviews"],
});
```

> [!IMPORTANT]
> Version range reviewed September 5, 2026. Maintain it against Shopify's schedule: not a perpetual default.

Never inferred from filenames: web-pixel requirements, minimum scopes, API behavior, listing content, installation, privacy processing, live performance.

## Listing inputs: only fields you pass

`{ listing: {} }` is no evidence of a complete listing. Source: Shopify's [listing best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices).

| Field                                   | Limit                                                     |
| --------------------------------------- | --------------------------------------------------------- |
| `appName` · `introduction` · `details`  | ≤ 30 · 100 · 500 Unicode code points (`appName` nonempty) |
| `features[]`                            | ≤ 80 each                                                 |
| `searchTerms` · `integrations`          | ≤ 5 · ≤ 6 nonempty strings                                |
| `structuredFeatures`                    | ≤ 25 nonempty features per unique category                |
| `appIcon`                               | PNG/JPEG 1200×1200                                        |
| `featureImage` · `desktopScreenshots[]` | 1600×900 + alt; 3–6 screenshots                           |
| all images                              | inside project; no byte-identical duplicates              |

<details>
<summary>Example, image reader, and what counts don't prove</summary>

```ts
const findings = await runShopifyAppConformance({
  root: process.cwd(),
  listing: {
    appIcon: "icon.png",
    desktopScreenshots: [
      { path: "one.png", alt: "Fixture view" },
      { path: "two.png", alt: "Fixture view" },
      { path: "three.jpg", alt: "Fixture view" },
    ],
  },
});
```

- `structuredFeatures` entries are `{ category, features }`; categories must be nonempty and unique after NFKC normalization, trim, and lowercase, so separate declarations cannot split one budget.
- Alt text must be nonempty. Image paths must be regular files. Duplicates: exact SHA-256 across the collection, even under different filenames.
- Shopify's editor stays authoritative for its character counter. Counts don't verify category membership, integration eligibility, search relevance, complete words, or merchant-facing meaning.

The independent header reader follows the [PNG IHDR](https://www.w3.org/TR/png-3/#11IHDR) and [JPEG SOF](https://www.w3.org/Graphics/JPEG/itu-t81.pdf) layouts.

| ✅ Does                                                           | ❌ Doesn't                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| read PNG/JPEG header dimensions                                   | decode pixels, validate payloads or CRCs              |
| fail other formats and unreadable headers (dimensions unverified) | apply EXIF orientation, support deferred JPEG heights |
| detect byte-identical copies                                      | catch recompressed or visually similar copies         |

A metadata-only fixture can pass its dimension check: preview and validate complete image files before upload. Covers only an observable subset of [App Store requirement 4.4.5](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements#provide-clear-assets-and-descriptions). Semantic image quality, readable alt text, privacy, pricing claims, trademarks, perceptual uniqueness, and mobile/POS screenshot coverage are separate review tasks.

</details>

## Evidence evaluators: call them yourself

Outside `shopifyAppChecks`. **None collects telemetry, authenticates artifacts, or awards Shopify status.**

| API                                    | You supply                             | Passes when                                                          | Does not prove                   |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| `evaluateShopifyIframeProtection`      | a response + authenticated shop        | enforced `frame-ancestors` = that shop + `https://admin.shopify.com` | route coverage, browser behavior |
| `probeShopifyWebhookHmac`              | isolated handler + signed fixture      | 2xx when valid, 401 for missing, malformed, body-mismatched HMAC     | timing safety, side effects      |
| `evaluateShopifyPerformance`           | normalized 28-day measurements         | every `required` metric meets its BFS threshold                      | telemetry trust, approval        |
| `evaluateShopifyStorefrontPerformance` | baseline + installed Lighthouse scores | weighted score drop ≤ 10 points                                      | freshness, representative config |

**Test every relevant HTML route with ≥ 2 authenticated shops, and each compliance topic through its actual handler.**

<details>
<summary>Evaluator details: examples, rejection rules, metric thresholds</summary>

### HTTP helpers

Each returns `findings[]`; invalid fixtures throw.

```ts
import { evaluateShopifyIframeProtection, probeShopifyWebhookHmac } from "@aurelienbbn/conformance-shopify-app";

expect(
  evaluateShopifyIframeProtection({
    response: new Response("<html></html>", {
      headers: {
        "content-security-policy": "frame-ancestors https://fixture-store.myshopify.com https://admin.shopify.com;",
      },
    }),
    embedded: true,
    authenticatedShopDomain: "fixture-store.myshopify.com",
  }),
).toEqual([]);

expect(
  await probeShopifyWebhookHmac({
    request: new Request("http://localhost/webhooks/privacy", {
      method: "POST",
      headers: {
        "x-shopify-topic": "shop/redact",
        "x-shopify-shop-domain": "fixture-store.myshopify.com",
      },
      body: JSON.stringify({ shop_id: 1, shop_domain: "fixture-store.myshopify.com" }),
    }),
    fixtureSigningSecret: "local-test-secret",
    handleRequest: verifiedHandler,
  }),
).toEqual([]);
```

**Iframe** ([guidance](https://shopify.dev/docs/apps/build/security/set-up-iframe-protection)):

- `authenticatedShopDomain` comes from verified authentication and must be a canonical `<name>.myshopify.com`, else throws.
- Fails: missing or report-only header, duplicate directives, wildcards, `self`, other tenants, non-ASCII / nonstandard whitespace.
- Other directives, and extra policies without `frame-ancestors`, are allowed; each policy declaring it follows the strict shape.
- Standalone apps (`embedded: false`) get ⚠️ warnings toward `'none'`: Shopify frames it as a recommendation.
- Also unproven: deployment correctness.

**HMAC** ([privacy webhook rejection](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance), [raw-body verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)): 4 calls to your injected handler, no network requests of its own.

```text
valid-control          signed body            ─▶ expect 2xx   (an always-rejecting route fails here)
missing-hmac           no header              ─▶ expect 401
malformed-hmac         "invalid-hmac"         ─▶ expect 401
body-mismatched-hmac   body + "\n", old sig   ─▶ expect 401   (still valid JSON, different signed bytes)
```

- Fixture: POST, valid JSON, canonical shop domain, one of the three privacy topics in `X-Shopify-Topic`, nonempty `fixtureSigningSecret` wired into the handler. Never a production secret.
- Handlers that throw fail. Also unproven: privacy processing, live delivery. Assert timing safety and side effects against the fixture dependencies.

### evaluateShopifyPerformance

Compares against the reviewed [Built for Shopify thresholds](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements). `shopifyPerformanceCriteria` exports every ID, unit, statistic, sample minimum, and boundary.

```ts
import { evaluateShopifyPerformance } from "@aurelienbbn/conformance-shopify-app";

const report = evaluateShopifyPerformance(evidence, {
  required: ["admin-lcp", "admin-cls", "admin-inp"],
  appId: "app-under-review",
  now: "2026-09-05T00:00:00.000Z",
});
// report.status: passed | failed | incomplete · report.results[]: { metric, requirement, status, message }
```

| Metric                         | BFS   | Statistic | Pass when |         Min samples | Extra field                    |
| ------------------------------ | ----- | --------- | --------- | ------------------: | ------------------------------ |
| `admin-lcp`                    | 2.1.1 | p75 ms    | ≤ 2500    |                 100 |                                |
| `admin-cls`                    | 2.1.2 | p75 score | ≤ 0.1     |                 100 |                                |
| `admin-inp`                    | 2.1.3 | p75 ms    | ≤ 200     |                 100 |                                |
| `checkout-carrier-latency`     | 2.3.1 | p95 ms    | **≤ 500** |                1000 |                                |
| `carrier-latency`              | 5.4.1 | p95 ms    | **< 500** |                1000 |                                |
| `checkout-carrier-failure`     | 2.3.1 | ratio %   | ≤ 0.1     |                1000 | `qualifyingSamples` = failures |
| `carrier-success`              | 5.4.2 | ratio %   | ≥ 99.9    |                1000 |                                |
| `fulfillment-volume`           | 5.8.1 | count     | ≥ 100     | `samples` = `value` |                                |
| `fulfillment-completion`       | 5.8.2 | ratio %   | ≥ 97      |                   1 | `excludedRecentDays: 7`        |
| `fulfillment-callback-success` | 5.8.3 | ratio %   | ≥ 99      |                   1 |                                |
| `fulfillment-tracking`         | 5.8.5 | ratio %   | ≥ 80      |                   1 | `withinHours: 1`               |
| `fulfillment-response`         | 5.8.6 | ratio %   | ≥ 95      |                   1 | `withinHours: 24`              |
| `cancellation-response`        | 5.8.7 | ratio %   | ≥ 99      |                   1 | `withinHours: 24`              |

The two carrier-latency boundaries differ on purpose.

- `ShopifyPerformanceMeasurement`: `metric`, `value`, `samples`, `unit`, `statistic`, `appId`, `source` (`shopify-dashboard` | `observability`), artifact `reference`, exact 28-day UTC window (`windowStart`, `windowEnd`) in canonical ISO form like `2026-09-05T00:00:00.000Z`.
- Ratios need integer `qualifyingSamples`; `value` must equal `qualifyingSamples * 100 / samples` within 1e-9: **supply the unrounded percentage.**
- Freshness: window ends at or before `now` and within `maxAgeDays` (default 1, a caller policy, not a Shopify rule).

| Outcome         | Trigger                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 💥 throws       | invalid options (`now`, `appId`, negative `maxAgeDays`), empty/duplicate/unknown `required`, evidence not an array of known-metric records |
| ⚠️ `incomplete` | missing, duplicated, stale, mismatched (app, unit, statistic, source), out-of-range, or insufficient measurement                           |
| ❌ `failed`     | an observed threshold violation; wins over `incomplete` overall                                                                            |
| ✅ `passed`     | every selected metric passes                                                                                                               |

Selecting metrics or labeling a source proves neither category applicability, trustworthy telemetry, complete populations, nor Shopify approval.

### evaluateShopifyStorefrontPerformance

```ts
import { evaluateShopifyStorefrontPerformance } from "@aurelienbbn/conformance-shopify-app";

const storefront = evaluateShopifyStorefrontPerformance({ baseline, installed }); // { status, reduction?, message }
```

Input: `{ baseline, installed }`, each a `ShopifyStorefrontRun` with matching `store`, `theme`, `runner`, `device: "mobile"`, distinct artifact `reference`s, and nonempty 0–100 score arrays for `pages.home`, `pages.product`, `pages.collection`.

```text
per page: average repeated scores, then weight
  home        ███▍              17%
  product     ████████          40%
  collection  ████████▌         43%

reduction = baseline − installed      ≤ 10 points ─▶ passed    (negative = improvement)
                                       > 10 points ─▶ failed    (bounded floating-point allowance)
missing · invalid · mismatched runs ──────────────▶ incomplete
```

Weights from [Shopify's storefront performance guide](https://shopify.dev/docs/apps/build/performance/storefront). Doesn't launch Lighthouse, verify matching page URLs or representative app configuration, enforce freshness, or authenticate artifacts.

</details>

## Migration

| Change                                                         | Migrate by                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| topic without a subscription destination no longer passes      | move stray `compliance_topics` into `[[webhooks.subscriptions]]`, each with a nonempty `uri` |
| topics not pooled across deployment manifests                  | select the deployment under review (`appManifest`) when local configs omit contracts         |
| backup-style manifest names ignored / rejected                 | rename to a CLI-compatible form, e.g. `shopify.app.production-eu.toml`                       |
| empty `documentEntries` / `platformMarkers`, invalid selectors | pass real values: they throw                                                                 |

## Sources

Independent implementations of Shopify's [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements), [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements), [app configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration), [API versioning](https://shopify.dev/docs/api/usage/versioning), and [theme app extension configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration). Discovery defaults verified against the MIT-licensed Shopify CLI's [configuration selection](https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/project/config-selection.ts) and [extension loader](https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/app/loader.ts). Source carries greppable `@attribution` tags.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                      | Trigger or review scope                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-version-contract`          | Webhook, app server, and versioned extension API versions must use quarterly version syntax, satisfy explicit version bounds, and agree between the app server and the webhook manifest. |
| `app-bridge-script`             | Embedded apps must load the App Bridge script from the Shopify CDN in the document head.                                                                                                 |
| `app-url-security`              | App and configured OAuth callback URLs must declare HTTPS transport without embedded credentials.                                                                                        |
| `built-for-shopify-extensions`  | Explicit Built for Shopify categories require their declared extension types and insertion targets; presence is only a prerequisite.                                                     |
| `checkout-bundle-size`          | Checkout extension dist JavaScript totals stay within the configured raw-byte budget; Shopify CLI remains the deployment authority.                                                      |
| `compliance-webhooks`           | Apps must subscribe to the three mandatory privacy compliance webhook topics.                                                                                                            |
| `extension-capability-contract` | Checkout and customer account UI extension source that uses fetch, Storefront API queries, or buyer journey interception must declare the matching capability in its extension TOML.     |
| `functions-localization`        | Function extensions using t: translation keys must ship a complete locales/ contract.                                                                                                    |
| `listing-inputs`                | Explicit listing metadata must fit documented lengths, image dimensions and screenshot counts, with alt text and no exact duplicate assets.                                              |
| `webhook-subscription-contract` | Declared webhook subscriptions must pair nonempty topic arrays with a supported delivery URI.                                                                                            |

### Credited concepts

- https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/app/loader.ts (MIT concept; independently implemented)
- https://shopify.dev/changelog/deprecating-the-usebuyerjourneyintercept-api-on-checkout-ui-extensions (inspiration; independently implemented)
- https://shopify.dev/docs/api/checkout-ui-extensions (inspiration; independently implemented)
- https://shopify.dev/docs/api/usage/versioning (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/checkout/capabilities (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/functions/localization-practices-shopify-functions (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration (inspiration; independently implemented)
- https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently implemented)
- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently implemented)
- https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices (inspiration; independently implemented)
- https://www.w3.org/Graphics/JPEG/itu-t81.pdf (file format specification; independently implemented)
- https://www.w3.org/TR/png-3/ (file format specification; independently implemented)

<!-- harness-catalog:end -->
