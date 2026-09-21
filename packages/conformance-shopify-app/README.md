# @aurelienbbn/conformance-shopify-app

Structural checks and explicit evidence evaluators for Shopify apps. Repository checks inspect manifests, files, and build output through plain functions or a Vitest adapter. Separate APIs evaluate supplied HTTP responses and performance measurements.

## Checks

- `compliance-webhooks`: app TOML must declare `customers/data_request`, `customers/redact`, and `shop/redact` under `webhooks.subscriptions` with nonempty delivery URIs. This checks the [App Store compliance-topic contract](https://shopify.dev/docs/apps/build/webhooks/subscribe); source mentions and unrelated tables do not register subscriptions.
- `app-bridge-script`: every selected embedded document must load `cdn.shopify.com/shopifycloud/app-bridge.js` as its first head script. Explicit `platformMarkers` can document an integration exception; none are accepted by default.
- `functions-localization`: extensions using `t:` translation keys must ship `locales/` with exactly one `<lang>.default.json` and complete keys; missing keys in non-default locales are warnings.
- `checkout-bundle-size`: recursive raw JavaScript totals for checkout extension build directories must stay within the configured budget (64 KB by default). Option `checkoutBundleLimitKb` sets a stricter budget; Shopify CLI decides deployment acceptance.
- `app-url-security`: app URLs and configured OAuth/customer callback URLs must declare HTTPS without credentials. Customer JavaScript origins cannot include paths, queries, or fragments. This does not verify TLS certificates or require an OAuth table for apps using another installation contract.
- `webhook-subscription-contract`: actual webhook array tables must declare nonempty topic arrays and a supported delivery URI. HTTPS, root-relative paths, Google Pub/Sub, and Shopify EventBridge destinations are recognized; fragments and credential-bearing HTTPS URLs fail. Cloud resource existence, webhook signatures, processing, and legal compliance need separate evidence.
- `api-version-contract`: webhook and versioned extension manifests must declare quarterly API versions. `minimumApiVersion` and `maximumApiVersion` enforce a reviewed deployment range. Without explicit bounds, this checks syntax only; `unstable` warns. With either bound, `unstable` fails. No lifecycle deadline is guessed from the system clock, and a date-shaped version is not evidence of current availability. The literal `apiVersion` in the app server module (`shopify.server.*` at the root, in `app/`, or in `src/`; override with `serverEntries`) is held to the same syntax and bounds, and a **warning** reports when it differs from a selected manifest's `[webhooks] api_version`, because webhook payloads and Admin queries would then follow different schemas. `ApiVersion.July26` resolves through the enum's month-and-year naming; `LATEST_API_VERSION` and other dynamic values are not resolved and stay silent.
- `built-for-shopify-extensions`: opt-in category prerequisites inspect declared extension types and targets. Reviews require a Flow trigger and customer details block; invoices require both order print surfaces; advertising, email marketing, forms, and SMS marketing require a segment action; subscriptions require a Customer Account target and a literal theme section block schema that permits product templates. This is partial structural coverage: extension functionality and category eligibility still require review.

- `listing-inputs`: explicitly supplied listing text, image paths, alt text, and screenshot collections must meet the documented quantitative guidance. It inspects PNG/JPEG header dimensions and detects exact duplicate bytes. See the listing options and limits below.

### Optional checks

`optionalShopifyAppChecks` are exported and catalogued but excluded from `shopifyAppChecks`, the Vitest adapter's default, and `runShopifyAppConformance`'s default. Opt in by passing a check list:

```ts
import { optionalShopifyAppChecks, shopifyAppChecks } from "@aurelienbbn/conformance-shopify-app";
import { shopifyAppConformance } from "@aurelienbbn/conformance-shopify-app/vitest";

shopifyAppConformance({ root: process.cwd() }, [...shopifyAppChecks, ...optionalShopifyAppChecks]);
```

- `extension-capability-contract` (**MAYBE, opt-in**): for UI extensions with a `purchase.*` or `customer-account.*` target, source under the extension's `src/` that calls `fetch()`, runs a Storefront API `query` (`shopify.query`, `useApi().query`, or `query` destructured from `useApi()`), or intercepts the buyer journey (`useBuyerJourneyIntercept`, `buyerJourney.intercept`) must be matched by `network_access`, `api_access`, or `block_progress = true` under `[extensions.capabilities]`. A missing declaration is reported as a contract mismatch between source and manifest. Shopify's [capabilities documentation](https://shopify.dev/docs/apps/build/checkout/capabilities) states the requirement, but the exact runtime behaviour without the capability was not verified against a dev store, so the finding makes no claim about a runtime failure. `block_progress` declared with an extension `api_version` of 2026-07 or later produces a warning that cites the [deprecation notice](https://shopify.dev/changelog/deprecating-the-usebuyerjourneyintercept-api-on-checkout-ui-extensions). Admin extensions are skipped: their app-domain `fetch` needs no capability. The scan is lexical: comments and quoted strings are ignored, files that bind or import their own `fetch` are skipped, and wrappers, re-exports, and code outside `src/` are not followed. Declared-but-unused capabilities are deliberately not reported, since shared packages outside the extension directory can own the call.

Findings carry a severity (`error`/`warning`) and the shopify.dev URL that justifies them. Warnings never fail the suite.

## Vitest usage

```ts
// conformance.test.ts
import { shopifyAppConformance } from "@aurelienbbn/conformance-shopify-app/vitest";

shopifyAppConformance({ root: process.cwd() });
```

## Programmatic usage

```ts
import { runShopifyAppConformance } from "@aurelienbbn/conformance-shopify-app";

const findings = await runShopifyAppConformance({ root: process.cwd() });
```

## Contract boundaries and migration

App configuration is parsed as TOML. Each deployment manifest must contain its own compliance topics; topics are not pooled across environments. App Bridge requires a real CDN script in the document head, or an explicitly configured injector marker. Markers are an explicit project integration exception, not proof of served markup.

Use `appManifest: "shopify.app.production.toml"` to scope both webhook and embedded-App-Bridge ownership to one deployment. Unset inspects CLI-compatible app manifests at the project root: `shopify.app.toml` or one environment suffix containing ASCII letters, digits, hyphens or underscores. Backup-style names such as `shopify.app.prod.backup.toml` are ignored during discovery and rejected as explicit selectors. Rename multi-part environment names to a CLI-compatible form such as `shopify.app.production-eu.toml`. A missing selected manifest is an error; invalid selectors are rejected. `runShopifyAppConformanceReport(options)` returns the selected `appManifests` alongside `findings`, so a saved report identifies its deployment scope. It remains a static preflight.

Migration: move stray `compliance_topics` fields into `[[webhooks.subscriptions]]` and give each subscription a nonempty `uri`. A topic mentioned without its subscription destination no longer passes. Select the deployment under review when local configurations intentionally omit deployment contracts.

Checkout budgets identify `purchase.checkout.*` targets from extension TOML and require built output. All `.js` files under that extension's `dist` are counted recursively (up to ten directory levels) as a conservative raw-byte total; this is not an entry-graph or compressed-transfer measurement. Shopify CLI remains the deployment authority. Function translations must resolve to owned string properties.

Extension checks follow selected manifests' `extension_directories` paths or positive glob patterns. Missing or empty lists use `extensions/*`, and each directory pattern matches `*.extension.toml` immediately inside it, following the reviewed Shopify CLI behavior. Recursive discovery requires an explicit `**`; nested examples cannot satisfy prerequisites by accident. Alternate manifest basenames are supported. Dependency manifests are excluded, while explicitly selected directories named `dist` remain eligible. Paths outside the project and invalid TOML are errors. Category prerequisites are evaluated separately for each deployment, so one environment cannot supply another's missing extension. A literal Liquid schema is only a prerequisite; Theme Check and a served product-page review remain necessary.

API versions are checked per extension after applying its override to the root default. Function localization reads only actual function names and effective descriptions. Checkout budgets inspect actual `ui_extension` targeting entries. Names or targets in unrelated settings do not activate these contracts. Both unified `[[extensions]]` files and standalone root extension tables are supported for these recognized types.

Use `documentEntries: ["app/root.tsx"]` when the served documents differ from the common entry filenames or the repository includes unused examples. Empty selectors and empty injector markers are rejected. A missing explicit document fails; no automatically discovered document produces a warning. Static JSX/HTML inspection cannot establish generated markup, script execution, or coverage of routes omitted by the caller.

```ts
const findings = await runShopifyAppConformance({
  root: process.cwd(),
  appManifest: "shopify.app.production.toml",
  documentEntries: ["app/root.tsx"],
  minimumApiVersion: "2025-10",
  maximumApiVersion: "2026-07",
  builtForShopifyCategories: ["product-reviews"],
});
```

The example's version range was reviewed on September 5, 2026. Maintain it against Shopify's current version schedule; it is not a perpetual default. Supported categories are `advertising`, `email-marketing`, `forms`, `sms-marketing`, `invoices`, `product-reviews`, and `subscriptions`. Conditional web-pixel requirements, minimum scopes, API behavior, app listing content, installation, privacy processing, and live performance are not inferred from filenames.

These checks independently implement concepts from Shopify's [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements), [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements), [app configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration), [API versioning](https://shopify.dev/docs/api/usage/versioning), and [theme app extension configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration). Discovery and per-entry defaults were verified against the MIT-licensed Shopify CLI's [configuration selection](https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/project/config-selection.ts) and [extension loader](https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/app/loader.ts), then independently implemented. Source code carries greppable `@attribution` tags. Shopify's review and deployment systems remain authoritative.

## Supplied performance evidence

`evaluateShopifyPerformance` compares normalized measurements with the reviewed [Built for Shopify thresholds](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements). Select applicable metrics through `required`; `shopifyPerformanceCriteria` exports their IDs, units, statistics, sample minimums, and boundaries. Supported groups cover admin Web Vitals, carrier latency and success/failure ratios, and fulfillment volume, completion, callbacks, tracking, and response times.

```ts
import { readFile } from "node:fs/promises";
import { evaluateShopifyPerformance } from "@aurelienbbn/conformance-shopify-app";

const measurements = JSON.parse(await readFile("artifacts/normalized-shopify-metrics.json", "utf8"));
const report = evaluateShopifyPerformance(measurements, {
  required: ["admin-lcp", "admin-cls", "admin-inp"],
  appId: "your-app-client-id",
  now: new Date().toISOString(),
  maxAgeDays: 1,
});
```

Each `ShopifyPerformanceMeasurement` identifies its metric, value, sample count, unit/statistic, app, source (`shopify-dashboard` or `observability`), artifact reference, and exact 28-day UTC window. Timestamps use canonical ISO form such as `2026-09-05T00:00:00.000Z`. Ratios also require integer `qualifyingSamples`; `value` must agree with `qualifyingSamples * 100 / samples` within numerical tolerance; supply the unrounded percentage. Completion requires `excludedRecentDays: 7`; tracking requires `withinHours: 1`; fulfillment and cancellation responses require `withinHours: 24`. The one-day default freshness limit is a caller policy, adjustable through `maxAgeDays`.

A report passes only when every selected metric passes. Missing, duplicated, stale, mismatched, or insufficient measurements are `incomplete`; an observed threshold violation is `failed` and takes precedence in the overall status. Invalid options, unknown metric IDs, and malformed outer evidence throw. Carrier latency boundaries intentionally differ: `checkout-carrier-latency` permits 500 ms, while `carrier-latency` requires less than 500 ms. Neither selecting metrics nor supplying a source label proves category applicability, trustworthy telemetry, complete populations, or Shopify approval.

`evaluateShopifyStorefrontPerformance` accepts `{ baseline, installed }`, each shaped as `ShopifyStorefrontRun`. Provide matching `store`, `theme`, and `runner` identifiers, `device: "mobile"`, distinct artifact `reference` values, and nonempty 0–100 score arrays under `pages.home`, `pages.product`, and `pages.collection`.

```ts
import { evaluateShopifyStorefrontPerformance } from "@aurelienbbn/conformance-shopify-app";

const runs = JSON.parse(await readFile("artifacts/normalized-storefront-runs.json", "utf8"));
const storefront = evaluateShopifyStorefrontPerformance(runs);
```

The evaluator averages repeated scores for each page type, then applies Shopify's [17% home, 40% product, and 43% collection weights](https://shopify.dev/docs/apps/build/performance/storefront). Its `reduction` is baseline minus installed score. The budget is 10 points, with only a bounded allowance for floating-point roundoff; a negative result indicates improvement. Missing, invalid, or mismatched runs remain `incomplete`. It does not launch Lighthouse, verify matching page URLs or representative app configuration, enforce freshness, or authenticate artifacts. Both performance APIs are explicit calls outside `shopifyAppChecks`.

## Optional listing inputs

Pass `listing` to check supplied fields against Shopify's [listing best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices). Omitted fields are not assessed; `{ listing: {} }` establishes no evidence of a complete listing. Text limits are 30 Unicode code points for `appName`, 100 for `introduction`, 500 for `details`, and 80 per `features` entry. Shopify's own editor remains authoritative for its character counter.

Optional `searchTerms` accepts at most five nonempty strings, and `integrations` accepts at most six. `structuredFeatures` accepts `{ category, features }` entries with at most 25 nonempty feature strings per category. Categories must be nonempty and unique after Unicode compatibility normalization, trimming, and lowercasing; separate declarations cannot divide one category's budget. These checks count supplied choices; they do not verify category membership, integration eligibility, search relevance, complete words, or merchant-facing meaning.

```ts
const findings = await runShopifyAppConformance({
  root: process.cwd(),
  listing: {
    appName: "Stock Desk",
    appIcon: "listing/icon.png",
    featureImage: { path: "listing/feature.jpg", alt: "Inventory summary and reorder suggestions" },
    desktopScreenshots: [
      { path: "listing/overview.png", alt: "Inventory overview with low-stock products" },
      { path: "listing/reorder.png", alt: "Reorder quantities for selected products" },
      { path: "listing/history.png", alt: "Completed purchase orders" },
    ],
  },
});
```

Icons require PNG or JPEG header dimensions of 1200×1200. Feature images and desktop screenshots require 1600×900 and nonempty alt text; a supplied desktop collection must contain 3–6 images. Paths must resolve to regular files inside the project. Exact SHA-256 duplicate bytes fail across the configured image collection, including copies saved under different filenames. This covers only an observable subset of [App Store requirement 4.4.5](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements#provide-clear-assets-and-descriptions); recompressed or visually similar copies still need review.

The independent header reader follows [PNG IHDR](https://www.w3.org/TR/png-3/#11IHDR) and [JPEG SOF](https://www.w3.org/Graphics/JPEG/itu-t81.pdf) layout specifications. It does not decode pixels, validate image payloads or CRCs, apply EXIF orientation, or support deferred JPEG heights. Other formats and unreadable dimension headers fail this preflight because their dimensions are unverified. A metadata-only fixture can pass its dimension check; preview and validate complete image files before upload. Semantic image quality, readable alt text, privacy, pricing claims, trademarks, and perceptual uniqueness are separate review tasks. Mobile/POS screenshot coverage is not inferred from a desktop collection.

## Supplied HTTP responses and isolated webhook handlers

`evaluateShopifyIframeProtection` checks an actual supplied response header against Shopify's [iframe protection guidance](https://shopify.dev/docs/apps/build/security/set-up-iframe-protection). For embedded apps, pass a canonical shop domain obtained from verified authentication. The enforced `frame-ancestors` must contain exactly that shop's HTTPS origin and `https://admin.shopify.com`. Missing or report-only headers, duplicate directives, wildcards, unrelated tenants, and nonstandard whitespace fail. Other directives and additional policies without `frame-ancestors` are allowed; each policy that declares it must follow the strict shape. Standalone `'none'` guidance produces warnings because Shopify describes it as a recommendation.

```ts
import { evaluateShopifyIframeProtection, probeShopifyWebhookHmac } from "@aurelienbbn/conformance-shopify-app";

expect(
  evaluateShopifyIframeProtection({
    response: await localAppHandler(authenticatedHtmlRequest),
    embedded: true,
    authenticatedShopDomain: authenticatedSession.shop,
  }),
).toEqual([]);

expect(
  await probeShopifyWebhookHmac({
    handleRequest: isolatedAppHandler,
    request: new Request("http://localhost/webhooks/privacy", {
      method: "POST",
      headers: {
        "x-shopify-topic": "shop/redact",
        "x-shopify-shop-domain": "fixture-shop.myshopify.com",
      },
      body: JSON.stringify({ shop_id: 1, shop_domain: "fixture-shop.myshopify.com" }),
    }),
    fixtureSigningSecret: "isolated-handler-test-secret",
  }),
).toEqual([]);
```

`probeShopifyWebhookHmac` independently implements Shopify's [privacy webhook rejection contract](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) and [raw-body verification guidance](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries). It calls the injected handler four times: a valid signed control must return 2xx, then missing, malformed, and body-mismatched signatures must return 401. The body mismatch preserves valid JSON while changing the signed bytes. An always-rejecting route fails its control. Wire isolated test data and the same fixture signing secret into the handler; the helper performs no network requests itself.

These APIs are invoked explicitly, outside the repository checks array. Test every relevant HTML route with at least two authenticated shops and exercise each compliance topic using its actual handler. One response cannot prove route coverage, browser behavior, or deployment correctness. HMAC response assertions cannot prove timing safety, absence of handler side effects, or successful privacy processing; assert those separately against the fixture dependencies.

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
