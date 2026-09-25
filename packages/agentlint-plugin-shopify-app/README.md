# @aurelienbbn/agentlint-plugin-shopify-app

**15 agentlint reviews for Shopify apps and extensions: a deterministic trigger finds the spot, a reviewer checks it against Shopify's own guidance.**

> [!WARNING]
> Requires the engine `@aurelienbbn/agentlint` `>=0.3.0 <0.4.0` as a peer. [Evidence](../../docs/compatibility.md#agentlint-engine).

**A finding is something to inspect, not a policy violation.** Resolutions in `.agentlint/acceptances.jsonl` keep review evidence; neither they nor a clean run prove App Store or Built for Shopify eligibility.

## Quick start

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-shopify-app#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` keeps an existing config and prints the install command; never installs. **Calibrate bindings before requiring `agentlint check --all`.**

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { checkoutExtensionPreset, shopifyAppPreset } from "@aurelienbbn/agentlint-plugin-shopify-app";

export default defineConfig({ extends: [shopifyAppPreset, checkoutExtensionPreset] });
```

## Rules

| Rule                            | `shopifyApp` | `appServer` | `checkoutExtension` | `starter` | Rev  | Options                                              |
| ------------------------------- | :----------: | :---------: | :-----------------: | :-------: | :--: | ---------------------------------------------------- |
| `session-token-auth`            |      ✅      |             |                     |    ✅     | 2 ⚠️ | `identityKeyPattern`                                 |
| `form-error-recovery`           |      ✅      |             |                     |    ✅     |  1   | `errorAttribute`                                     |
| `action-label-clarity`          |      ✅      |             |                     |           |  1   | `ambiguousLabelPatterns`                             |
| `banner-usage`                  |      ✅      |             |                     |           |  1   |                                                      |
| `destructive-action-review`     |      ✅      |             |                     |           |  1   | `toneAttribute`, `destructiveTone`                   |
| `modal-workflow-review`         |      ✅      |             |                     |           |  1   |                                                      |
| `no-pressure-copy`              |      ✅      |             |                     |           |  1   | `languages` (`en`, `fr`, `de`), `additionalPatterns` |
| `review-solicitation`           |      ✅      |             |                     |           |  1   | `additionalPatterns`, `useDefaultPatterns`           |
| `settings-save-bar`             |      ✅      |             |                     |           | 1 ⚠️ | `formElementPattern`, `saveBarMarkerPattern`         |
| `admin-api-loop-review`         |              |     ✅      |                     |           |  1   | `graphqlCalleePattern`                               |
| `webhook-handler-review`        |              |     ✅      |                     |           |  1   | `topicPattern`                                       |
| `checkout-network-discipline`   |              |             |         ✅          |           | 2 ⚠️ | `networkCallPattern`                                 |
| `scope-change-review` 🧪        |              |             |                     |           |  1   | `manifestPattern`                                    |
| `flow-action-handler-review` 🧪 |              |             |                     |           |  1   | `handlerPathPattern`                                 |
| `app-ux-review` 🧪              |              |             |                     |           |  1   | `targets`, `elementNamePattern`                      |

Presets are `<name>Preset`. 🧪 in no preset: register `scopeChangeReview`, `flowActionHandlerReview` / a configured `defineAppUxReview(...)`. All rules: agent authority, detector 1. Presets ignore `**/*.d.ts`. ⚠️ see [migration](#migration).

| Preset                    | Scope                                           | Narrow it to                                                                             |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `shopifyAppPreset`        | `**/*.{ts,tsx,js,jsx}` + `**/locales/**/*.json` | your App Home source, when the repo holds several Shopify surfaces                       |
| `appServerPreset`         | `**/*.{ts,tsx,js,jsx}`, tests excluded          | server code (`app/routes/**`, `app/**/*.server.*`, workers) beside other GraphQL clients |
| `checkoutExtensionPreset` | `extensions/**/*.{ts,tsx,js,jsx}`               |                                                                                          |

Every rule exports a `defineX(options)` factory; register the configured instance under the same rule id. Stateful regular expressions are reset before each match.

```ts
defineNoPressureCopy({ languages: ["en", "fr"], additionalPatterns: [/última oportunidad/iu] });
defineSettingsSaveBar({ saveBarMarkerPattern: /useSaveBar/ });
```

## What fires

```tsx
<form data-save-bar>…</form>           // ✅ direct literal attribute
<form title="SaveBar">…</form>          // ❌ a mention isn't a marker
<form data-save-bar={false}>…</form>    // ❌ false or dynamic values don't count
```

```ts
for (const id of ids) await admin.graphql(QUERY, { variables: { id } }); // ❌ admin-api-loop-review
for (const edge of (await admin.graphql(QUERY)).edges) {
  total += edge.node.count;
} // ✅ the iterable
```

**A save bar elsewhere in the source no longer suppresses a form's review.** **App Home rules match exact JSX names:** no import, wrapper or spread resolution; set `elementNamePattern` for your reviewed wrappers.

<details>
<summary>Copy, auth and forms: triggers and boundaries</summary>

| Rule                  | Fires on                                                                                                 | Boundary                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `no-pressure-copy`    | urgency, scarcity or outcome-guarantee wording in JSX text or strings                                    | default lexicons: `en`, `fr`, `de`                                                                                           |
| `session-token-auth`  | `document.cookie`; `localStorage` / `sessionStorage` `getItem` / `setItem` with an identity-carrying key | `identityKeyPattern` default: token/session/auth/jwt/credential/api-key. Lexical candidates, not authentication verification |
| `settings-save-bar`   | a `<form>` / `<Form>` opening element without its own save-bar marker                                    | a custom `saveBarMarkerPattern` stays a trusted escape hatch over the opening element                                        |
| `review-solicitation` | specific review-request phrases in JSX text or strings                                                   | English, French and German defaults are partial lexicons; neutral requests still need placement and incentive review         |

Recognized save-bar markers don't prove dirty-state or navigation behavior: exercise those states with a route review.

`session-token-auth` also asks that offline tokens are read through the library's session storage: copies kept elsewhere go stale under the `expiringOfflineAccessTokens` future flag. Guidance uses current ID token terminology; the rule ID stays `session-token-auth`.

English style and readability scores are never treated as universal locale or accessibility requirements.

</details>

<details>
<summary>App Home components: triggers and boundaries</summary>

They don't resolve imports, wrappers, dynamic components, spread props or generated templates. A name matching another Shopify surface doesn't make App Home guidance apply there: scope these rules to the right files.

| Rule                        | Fires on                                                                 | Boundary                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `action-label-clarity`      | configured ambiguous literal text directly inside `s-button` or `s-link` | `ambiguousLabelPatterns` replaces a small English default lexicon; translation helpers and arbitrary strings aren't analyzed |
| `banner-usage`              | `s-banner`, including `dismissible`                                      | needs rendered context and dismissal-persistence evidence; a correct prop can't establish either                             |
| `destructive-action-review` | `s-button` or `s-clickable` with literal `tone="critical"`               | dynamic tones need separate review                                                                                           |
| `form-error-recovery`       | a known Polaris input control with a possibly active `error` prop        | empty, `false`, `null`, `undefined` literals stay silent; runtime expressions schedule review                                |
| `modal-workflow-review`     | `s-modal` or `s-app-window`                                              | reviews entry paths, task fit, dismissal, recovery; structural slot rules are separate                                       |

The Text field reference encourages feedback during typing; the Alerts guide recommends errors after blur. `form-error-recovery` exposes that difference and asks for untouched, typing, blur, submission and recovery evidence. It doesn't ban `onInput` or certify validation timing from a prop.

</details>

<details>
<summary>Server: loops, webhooks, Flow actions, scopes</summary>

| Rule                            | Fires on                                                                                                                                                                                                                      | Stays silent                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `admin-api-loop-review`         | `admin.graphql`, `client.request` or `client.query` (optionally qualified) inside a `for` / `for…of` / `while` / `do` body, or a `.map` / `.forEach` / `.flatMap` callback                                                    | a `for…of` iterable, a `for` initializer, functions merely defined inside a loop; test files       |
| `webhook-handler-review`        | once per file: `authenticate.webhook`, an `X-Shopify-Hmac-Sha256` / `X-Shopify-Topic` / `X-Shopify-Webhook-Id` string, or a known topic literal (`orders/create`, `APP_UNINSTALLED`) as a `switch` case or comparison operand | test files                                                                                         |
| `flow-action-handler-review` 🧪 | once per file: `authenticate.flow`, an `action_run_id` / `action_definition_id` key (member, destructuring, computed or object key), or a path matching `handlerPathPattern`                                                  | preview and validation endpoints (no run id), the key as plain text; test files                    |
| `scope-change-review` 🧪        | change rule: `shopify.app.toml` / `shopify.app.<name>.toml` whose `[access_scopes]` `scopes` / `optional_scopes` (or legacy top-level `scopes`) gained entries since the Git baseline                                         | removed, reordered or demoted scopes; unchanged manifests are never inventoried, even with `--all` |

| Limit                        |                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-api-loop-review`      | `graphqlCalleePattern` adds project wrappers; imports and aliases aren't resolved. Bounded pagination is legitimate: the finding asks for the bound and the throttle handling                                                                                                                                             |
| `webhook-handler-review`     | `topicPattern` replaces the default topic lexicon. Constant-time database work inline passes; dedup or queueing in another file is evidence the reviewer cites, not something the trigger resolves                                                                                                                        |
| `flow-action-handler-review` | asks for HMAC, `action_run_id` dedup, a status within 10 s (202 for longer work), 4xx only for permanent failures, and a `return_value` body. Doesn't read `runtime_url` from TOML: set `handlerPathPattern` for handlers that delegate the payload elsewhere. A manual HMAC check also triggers `webhook-handler-review` |
| `scope-change-review`        | reads two known keys; not a TOML parser. Scope necessity is judged, never proven                                                                                                                                                                                                                                          |

</details>

## Checkout: first paint waits on nothing avoidable

`checkout-network-discipline` fires on `fetch` (bare or `window.` / `globalThis.` / `self.`-qualified) and `shopify.query()` under `extensions/**`; `networkCallPattern` adds a project fetch wrapper. **The trigger can't establish latency: review measured request and rendering timings against both performance sources.** Keep network calls out of module scope.

<details>
<summary>What the checkout sources say</summary>

| Source                                                                                                            | Says                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Checkout extension performance](https://shopify.dev/docs/apps/build/checkout/extension-performance)              | load necessary initial data in the extension callback before first paint, so Shopify's loading skeleton stays until stable content is ready                                                                            |
| [Checkout best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps) | response time below one second; initial skeletons                                                                                                                                                                      |
| [Checkout capabilities](https://shopify.dev/docs/apps/build/checkout/capabilities)                                | backend trusts only verified session-token claims · no buyer-callable sensitive endpoint · answers with `Access-Control-Allow-Origin: *` · doesn't expect `logged_in_customer_id` on App Proxy calls from an extension |

</details>

## `app-ux-review` 🧪: you map files to review areas

**Dormant by default; purpose is never inferred from filenames.** Prefer narrowly configured rules over stretching the App Home preset across checkout, admin and Sidekick extensions.

```text
areas  home · onboarding · navigation · responsive · premium · visual-editor · inputs
       collections · content · copy-mechanics · checkout · admin-extension · sidekick
```

<details>
<summary>Configuration and reporting</summary>

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { defineAppUxReview, shopifyAppPreset } from "@aurelienbbn/agentlint-plugin-shopify-app";

export default defineConfig({
  extends: [shopifyAppPreset],
  rules: [
    defineAppUxReview({
      targets: [
        { filenamePattern: /\/app\._index\.tsx$/, areas: ["home", "responsive"] },
        { filenamePattern: /editor\.tsx$/, areas: ["visual-editor"] },
        { filenamePattern: /extensions\/admin\//, areas: ["admin-extension"], trigger: "file" },
        { filenamePattern: /sidekick\.ts$/, areas: ["sidekick"], trigger: "file" },
      ],
    }),
  ],
});
```

| Target kind       | Reports at                                                      |
| ----------------- | --------------------------------------------------------------- |
| page (default)    | the first matching `s-page`                                     |
| `trigger: "file"` | the TS/JS program node: extension entry points without page JSX |

Each trigger reports once per file, combining matching areas; the finding names only those areas. Review them, attach the source revision and browser or runtime observations, and record unresolved states. The rule doesn't read manifests or discover extension targets.

</details>

## Migration

| Rule                                                         | Change                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| ⚠️ `checkout-network-discipline`, `session-token-auth` rev 2 | added the capabilities security checks and the offline-token session-storage check |
| ⚠️ `settings-save-bar`                                       | only a direct literal `data-save-bar` on the form suppresses review                |

Requirement IDs and evidence boundaries: [`policy/shopify-requirements.json`](../../policy/shopify-requirements.json) and the repository Shopify checks.

<details>
<summary>Agentlint rule contract</summary>

| Fact                | Detail                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| rule shape          | `lifecycle`, `standard` (revision), `detector` (version), `binding` (id, authority, scope, material options)                  |
| composing           | `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`; repeated uses need distinct binding ids |
| authority           | defaults permit agent acceptance; repository owners choose scope and can raise authority to `human`                           |
| accepting a finding | requires matching current evidence **and** authority                                                                          |
| fixtures            | `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser                           |

</details>

## Sources

Independently implemented from Shopify's official documentation; no Shopify code or templates vendored. Greppable `@attribution` tags mark source concepts in implementation files. `starterPreset` onboarding: conceptual inspiration from desloppify by Peter O'Malley; no code or guidance copied.

<details>
<summary>Inspected pages, by date and rule</summary>

| Inspected  | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Feeds                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-09-05 | [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements), [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | applicability and numbered obligations                                             |
| 2026-09-05 | [Content](https://shopify.dev/docs/apps/design/content), [Marketing](https://shopify.dev/docs/apps/design/user-experience/marketing), [Alerts](https://shopify.dev/docs/apps/design/user-experience/alerts), [Forms](https://shopify.dev/docs/apps/design/user-experience/forms)                                                                                                                                                                                                                                                                                                                                                                                                              | readable actions, restrained promotion, understandable feedback, organized editing |
| 2026-09-05 | [Voice and tone](https://shopify.dev/docs/apps/design/content/voice-and-tone), [Grammar and mechanics](https://shopify.dev/docs/apps/design/content/grammar-and-mechanics)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | situation-appropriate copy, locale-specific mechanics                              |
| 2026-09-05 | [App structure](https://shopify.dev/docs/apps/design/app-structure)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | rendered review of admin extension size and workflow fit                           |
| 2026-09-05 | [App Home](https://shopify.dev/docs/apps/design/user-experience/app-home-page), [Onboarding](https://shopify.dev/docs/apps/design/user-experience/onboarding), [Navigation](https://shopify.dev/docs/apps/design/navigation), [Layout](https://shopify.dev/docs/apps/design/layout)                                                                                                                                                                                                                                                                                                                                                                                                           | route-level review areas                                                           |
| 2026-09-05 | Polaris [Button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button), [Banner](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner), [Modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal), [Text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field)                                                                                                                                                                                                                                                                                                    | component intent and behavior                                                      |
| 2026-09-05 | Polaris [Switch](https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch), [Color picker](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker), [Table](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table), [Choice list](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list), [Menu](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu), [Tooltip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip), [Paragraph](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph) | targeted input, collection and content review                                      |
| 2026-09-05 | [Checkout extension performance](https://shopify.dev/docs/apps/build/checkout/extension-performance), [Checkout best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | initial rendering sequence, measured response-time target                          |
| 2026-09-05 | [ID tokens](https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens), [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | current platform guidance                                                          |
| 2026-09-19 | [Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql/latest), [API limits](https://shopify.dev/docs/api/usage/limits), [bulk operations](https://shopify.dev/docs/api/usage/bulk-operations/queries), [idempotency](https://shopify.dev/docs/api/usage/implementing-idempotency)                                                                                                                                                                                                                                                                                                                                                                                                    | `admin-api-loop-review`                                                            |
| 2026-09-19 | [HTTPS webhook delivery](https://shopify.dev/docs/apps/build/webhooks/subscribe/https), [duplicate webhooks](https://shopify.dev/docs/apps/build/webhooks/ignore-duplicates), [webhook best practices](https://shopify.dev/docs/apps/build/webhooks/best-practices), [`authenticate.webhook`](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/webhook)                                                                                                                                                                                                                                                                                                              | `webhook-handler-review`                                                           |
| 2026-09-19 | [access scope management](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes), [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `scope-change-review`                                                              |
| 2026-09-19 | [checkout capabilities](https://shopify.dev/docs/apps/build/checkout/capabilities), [`shopify-app-js` future flags](https://github.com/Shopify/shopify-app-js)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | extended checkout and authentication guidance                                      |
| 2026-09-24 | [Flow action endpoints](https://shopify.dev/docs/apps/build/flow/actions/endpoints), [create a Flow action](https://shopify.dev/docs/apps/build/flow/actions/create), [complex data types](https://shopify.dev/docs/apps/build/flow/configure-complex-data-types)                                                                                                                                                                                                                                                                                                                                                                                                                             | `flow-action-handler-review`                                                       |

</details>

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                    | Trigger or review scope                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `action-label-clarity`        | Reviews configured ambiguous literal labels on Polaris actions in their merchant context.                                                   |
| `admin-api-loop-review`       | Flags Admin GraphQL calls issued from loops or iteration callbacks for cost, batching, and throttle review.                                 |
| `app-ux-review`               | Requests UX evidence for explicitly configured app routes and extension entry points.                                                       |
| `banner-usage`                | Reviews App Home banners for purpose, context, dismissal persistence, and competing messages.                                               |
| `checkout-network-discipline` | Flags network calls in checkout extension code for latency-budget review.                                                                   |
| `destructive-action-review`   | Reviews actions explicitly marked with a destructive tone for consequences, confirmation, and failure handling.                             |
| `flow-action-handler-review`  | Flags Shopify Flow action runtime handlers once per file for signature, duplicate-run, response-time, status-code, and return-value review. |
| `form-error-recovery`         | Reviews Polaris form controls with error wiring for understandable, persistent recovery feedback.                                           |
| `modal-workflow-review`       | Reviews modal and app-window workflows for merchant initiation, task fit, and usable dismissal.                                             |
| `no-pressure-copy`            | Flags urgency, scarcity, or outcome-guarantee copy in merchant-facing UI.                                                                   |
| `review-solicitation`         | Reviews app-rating request phrases for neutral wording, incentives, placement, and merchant control.                                        |
| `scope-change-review`         | Flags access scopes added to a Shopify app manifest since the baseline for necessity review.                                                |
| `session-token-auth`          | Flags cookie or Web Storage identity state in embedded Shopify app code.                                                                    |
| `settings-save-bar`           | Flags forms in embedded app pages that lack a contextual save bar integration.                                                              |
| `webhook-handler-review`      | Flags Shopify webhook handlers once per file for response-time, duplicate-delivery, ordering, uninstall, and compliance review.             |

### Credited concepts

- https://github.com/Shopify/shopify-app-js (expiringOfflineAccessTokens future flag concept; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/actions/button (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal (inspiration; independently implemented)
- https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip (inspiration; independently implemented)
- https://shopify.dev/docs/api/usage/bulk-operations/queries (inspiration; independently implemented)
- https://shopify.dev/docs/api/usage/limits (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/checkout/capabilities (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/checkout/extension-performance (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/flow/actions/create (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/flow/actions/endpoints (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/flow/configure-complex-data-types (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/webhooks/best-practices (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/webhooks/ignore-duplicates (inspiration; independently implemented)
- https://shopify.dev/docs/apps/build/webhooks/subscribe/https (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/app-structure (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/content (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/content/grammar-and-mechanics (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/content/voice-and-tone (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/layout (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/navigation (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/user-experience/alerts (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/user-experience/app-home-page (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/user-experience/forms (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/user-experience/marketing (inspiration; independently implemented)
- https://shopify.dev/docs/apps/design/user-experience/onboarding (inspiration; independently implemented)
- https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently implemented)
- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently implemented)
- https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps (inspiration; independently implemented)

<!-- harness-catalog:end -->
