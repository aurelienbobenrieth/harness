# @aurelienbbn/agentlint-plugin-shopify-app

Private draft. Development links to the sibling agentlint workspace; packed evidence uses the reviewed local archive; public agentlint 0.1.5 exposes an incompatible API. See the [compatibility evidence](../../docs/compatibility.md#private-draft-boundary).

Custom agentlint rules for Shopify app and extension code. Deterministic triggers schedule contextual reviews. A finding identifies something to inspect; it does not establish a policy violation. Resolutions in `.agentlint/acceptances.jsonl` can preserve review evidence, but neither an accepted resolution nor a clean run proves App Store or Built for Shopify eligibility.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

## Configuration

Every rule exports a `defineX(options)` factory next to its default instance; register the configured instance under the same rule id:

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { defineNoPressureCopy, defineSettingsSaveBar } from "@aurelienbbn/agentlint-plugin-shopify-app";

export default defineConfig({
  rules: [
    defineNoPressureCopy({
      languages: ["en", "fr"],
      additionalPatterns: [/última oportunidad/iu],
    }),
    defineSettingsSaveBar({ saveBarMarkerPattern: /useSaveBar/ }),
  ],
});
```

Options: `no-pressure-copy` (`languages`, `additionalPatterns`), `session-token-auth` (`identityKeyPattern`), `settings-save-bar` (`formElementPattern`, `saveBarMarkerPattern`), `checkout-network-discipline` (`networkCallPattern`), `admin-api-loop-review` (`graphqlCalleePattern`), `webhook-handler-review` (`topicPattern`), `scope-change-review` (`manifestPattern`). Stateful regular expressions are reset before each match.

The App Home component reviews match exact JSX grammar names. They do not resolve imports, wrappers, dynamic components, spread props, or generated templates. Configure `elementNamePattern` to identify your own reviewed wrappers. Matching component names from another Shopify surface does not establish that App Home guidance applies there: scope these rules to the appropriate files.

| Review                      | Trigger                                                                                          | Additional options and boundary                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action-label-clarity`      | Configured ambiguous literal text directly inside `s-button` or `s-link`                         | `ambiguousLabelPatterns` replaces a small English default lexicon. Translation helpers and arbitrary strings are not analyzed.                                               |
| `banner-usage`              | `s-banner`, including one with `dismissible`                                                     | Requires rendered context and dismissal persistence evidence; a correct prop cannot establish either.                                                                        |
| `destructive-action-review` | `s-button` or `s-clickable` with literal `tone="critical"`                                       | `toneAttribute`, `destructiveTone`. Dynamic tones need separate review.                                                                                                      |
| `form-error-recovery`       | Known Polaris input control with a possibly active `error` prop                                  | `errorAttribute`. Empty, false, null, and undefined literals remain silent; runtime expressions schedule review.                                                             |
| `modal-workflow-review`     | `s-modal` or `s-app-window`                                                                      | Reviews entry paths, task fit, dismissal, and recovery; structural slot rules are separate.                                                                                  |
| `review-solicitation`       | Specific review-request phrases in JSX text or strings                                           | `additionalPatterns`, `useDefaultPatterns`; English, French, and German phrase defaults are partial lexicons. Neutral requests still require placement and incentive review. |
| `app-ux-review`             | Explicit filename-to-purpose targets and a matching page component, or a configured file trigger | `targets`, `elementNamePattern`. Dormant by default and excluded from presets.                                                                                               |

### Server-side reviews

| Review                   | Trigger                                                                                                                                                                                                                                                | Additional options and boundary                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-api-loop-review`  | A call whose callee is `admin.graphql`, `client.request`, or `client.query` (optionally qualified) inside a `for`/`for…of`/`while`/`do` body, or inside a callback passed to `.map`, `.forEach`, or `.flatMap`                                         | `graphqlCalleePattern` adds project wrappers. A `for…of` iterable, a `for` initializer, and functions merely defined inside a loop stay silent. Imports and aliases are not resolved. Bounded pagination is legitimate: the finding asks for the bound and the throttle handling. |
| `webhook-handler-review` | Once per file: an `authenticate.webhook` call, an `X-Shopify-Hmac-Sha256`/`X-Shopify-Topic`/`X-Shopify-Webhook-Id` string literal, or a known webhook topic literal (`orders/create`, `APP_UNINSTALLED`) used as a `switch` case or comparison operand | `topicPattern` replaces the default topic lexicon. Test files are excluded. Constant-time database work inline passes; deduplication or queueing in another file is evidence the reviewer cites, not something the trigger resolves.                                              |
| `scope-change-review`    | **Opt-in (MAYBE).** Change rule: a `shopify.app.toml` or `shopify.app.<name>.toml` whose `[access_scopes]` `scopes`/`optional_scopes` (or legacy top-level `scopes`) gained entries since the Git baseline                                             | `manifestPattern`. In no preset. Removed, reordered, or demoted scopes stay silent; unchanged manifests are never inventoried, even with `--all`. It reads two known keys and is not a TOML parser. Scope necessity is judged, never proven.                                      |

### Route and extension reviews

Select review areas using project knowledge. A page target reports at its first matching `s-page`; a `trigger: "file"` target reports at the TypeScript/JavaScript program node, which supports extension entry points without page JSX. Each trigger reports once per file and combines matching areas. Unknown purpose is not inferred from filenames.

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { defineAppUxReview, shopifyAppPreset } from "@aurelienbbn/agentlint-plugin-shopify-app";

export default defineConfig({
  extends: [shopifyAppPreset],
  rules: [
    defineAppUxReview({
      targets: [
        {
          filenamePattern: /\/routes\/app\._index\.tsx$/,
          areas: ["home", "onboarding", "responsive", "content"],
        },
        { filenamePattern: /\/routes\/app\.editor\.tsx$/, areas: ["visual-editor", "inputs"] },
        {
          filenamePattern: /\/extensions\/checkout\/src\/index\.tsx$/,
          areas: ["checkout"],
          trigger: "file",
        },
        {
          filenamePattern: /\/extensions\/sidekick\/src\/index\.ts$/,
          areas: ["sidekick"],
          trigger: "file",
        },
      ],
    }),
  ],
});
```

Available areas: `home`, `onboarding`, `navigation`, `responsive`, `premium`, `visual-editor`, `inputs`, `collections`, `content`, `copy-mechanics`, `checkout`, `admin-extension`, `sidekick`. The finding names the areas applicable to that file. Review only those areas, attach source revision and browser or runtime observations, and record unresolved states. This rule does not read manifests or discover extension targets. Prefer narrowly configured rules over extending the whole App Home preset across checkout, admin, and Sidekick extensions.

## Presets

- `shopifyAppPreset`: nine App Home and copy/auth/form reviews over `**/*.{ts,tsx,js,jsx}` and locale JSON. Scope the preset to your App Home source when a repository contains multiple Shopify surfaces.
- `appServerPreset`: `admin-api-loop-review` and `webhook-handler-review` over `**/*.{ts,tsx,js,jsx}`, test files excluded. Scope it to server code (`app/routes/**`, `app/**/*.server.*`, workers) in repositories that also hold other GraphQL clients.
- `checkoutExtensionPreset`: `checkout-network-discipline` scoped to `extensions/**`.
- `scope-change-review` belongs to no preset; register `scopeChangeReview` explicitly.

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { checkoutExtensionPreset, shopifyAppPreset } from "@aurelienbbn/agentlint-plugin-shopify-app";

export default defineConfig({
  extends: [shopifyAppPreset, checkoutExtensionPreset],
});
```

## Contract boundaries and migration

A save bar elsewhere in the source no longer suppresses a form's review. The default now recognizes an actual direct `data-save-bar` attribute with literal presence; a title that mentions `SaveBar`, a false JSX value, or a dynamic value does not suppress review. A custom `saveBarMarkerPattern` remains a trusted project escape hatch over the opening element. Recognized markers do not prove dirty-state or navigation behavior; exercise those states with a route review.

The checkout review includes `shopify.query()` and follows the dedicated performance guide: necessary initial data loads in the extension callback before first paint so Shopify's loading skeleton remains until stable content is ready. The broader [checkout best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps) set a response-time target below one second and recommend initial skeletons. Review measured request and rendering timings against both sources; the trigger cannot establish latency. Keep network calls out of module scope.

The Text field reference encourages feedback during typing, while the Alerts guide recommends errors after blur. The form review exposes this difference and asks for untouched, typing, blur, submission, and recovery evidence. It does not ban `onInput` or certify validation timing from a prop.

The checkout review also carries the [capabilities](https://shopify.dev/docs/apps/build/checkout/capabilities) security checks: the backend trusts only verified session-token claims, exposes no buyer-callable sensitive endpoint, answers with `Access-Control-Allow-Origin: *`, and does not expect `logged_in_customer_id` on App Proxy calls made from an extension. `session-token-auth` additionally asks that offline tokens are read through the library's session storage, because copies kept elsewhere go stale under the `expiringOfflineAccessTokens` future flag. Both standards moved to revision 2 with these checks.

Authentication guidance uses the current ID token terminology while preserving the `session-token-auth` rule ID. Cookie and storage triggers remain lexical candidates, not authentication verification. English copy style and readability scores are never treated as universal locale or accessibility requirements.

## Sources and attribution

The rules independently implement review triggers and guidance inspired by Shopify's official documentation, inspected on 2026-09-05. No Shopify source code or documentation templates are vendored. Greppable `@attribution` tags identify the source concepts in implementation files.

- [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) and [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): applicability and numbered obligations.
- [Content](https://shopify.dev/docs/apps/design/content), [Marketing](https://shopify.dev/docs/apps/design/user-experience/marketing), [Alerts](https://shopify.dev/docs/apps/design/user-experience/alerts), and [Forms](https://shopify.dev/docs/apps/design/user-experience/forms): readable actions, restrained promotion, understandable feedback, and organized editing.
- [Voice and tone](https://shopify.dev/docs/apps/design/content/voice-and-tone) and [Grammar and mechanics](https://shopify.dev/docs/apps/design/content/grammar-and-mechanics): situation-appropriate copy and locale-specific mechanics; [App structure](https://shopify.dev/docs/apps/design/app-structure): rendered review of admin extension size and workflow fit.
- [App Home](https://shopify.dev/docs/apps/design/user-experience/app-home-page), [Onboarding](https://shopify.dev/docs/apps/design/user-experience/onboarding), [Navigation](https://shopify.dev/docs/apps/design/navigation), and [Layout](https://shopify.dev/docs/apps/design/layout): route-level review areas.
- Polaris [Button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button), [Banner](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner), [Modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal), and [Text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field): component intent and behavior.
- Polaris [Switch](https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch), [Color picker](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker), [Table](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table), [Choice list](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list), [Menu](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu), [Tooltip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip), and [Paragraph](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph): targeted input, collection, and content review.
- [Checkout extension performance](https://shopify.dev/docs/apps/build/checkout/extension-performance) and [Checkout best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps): initial rendering sequence and measured response-time target. [ID tokens](https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens) and [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api): current platform guidance.

- Server-side reviews, inspected on 2026-09-19: [Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql/latest), [API limits](https://shopify.dev/docs/api/usage/limits), [bulk operations](https://shopify.dev/docs/api/usage/bulk-operations/queries), and [idempotency](https://shopify.dev/docs/api/usage/implementing-idempotency) for `admin-api-loop-review`; [HTTPS webhook delivery](https://shopify.dev/docs/apps/build/webhooks/subscribe/https), [duplicate webhooks](https://shopify.dev/docs/apps/build/webhooks/ignore-duplicates), [webhook best practices](https://shopify.dev/docs/apps/build/webhooks/best-practices), and [`authenticate.webhook`](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/webhook) for `webhook-handler-review`; [access scope management](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes) and [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data) for `scope-change-review`; [checkout capabilities](https://shopify.dev/docs/apps/build/checkout/capabilities) and the [`shopify-app-js` future flags](https://github.com/Shopify/shopify-app-js) for the extended checkout and authentication guidance.

Requirement IDs and evidence boundaries are governed by [`policy/shopify-requirements.json`](../../policy/shopify-requirements.json) and the repository Shopify checks.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                    | Trigger or review scope                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `action-label-clarity`        | Reviews configured ambiguous literal labels on Polaris actions in their merchant context.                                       |
| `admin-api-loop-review`       | Flags Admin GraphQL calls issued from loops or iteration callbacks for cost, batching, and throttle review.                     |
| `app-ux-review`               | Requests UX evidence for explicitly configured app routes and extension entry points.                                           |
| `banner-usage`                | Reviews App Home banners for purpose, context, dismissal persistence, and competing messages.                                   |
| `checkout-network-discipline` | Flags network calls in checkout extension code for latency-budget review.                                                       |
| `destructive-action-review`   | Reviews actions explicitly marked with a destructive tone for consequences, confirmation, and failure handling.                 |
| `form-error-recovery`         | Reviews Polaris form controls with error wiring for understandable, persistent recovery feedback.                               |
| `modal-workflow-review`       | Reviews modal and app-window workflows for merchant initiation, task fit, and usable dismissal.                                 |
| `no-pressure-copy`            | Flags urgency, scarcity, or outcome-guarantee copy in merchant-facing UI.                                                       |
| `review-solicitation`         | Reviews app-rating request phrases for neutral wording, incentives, placement, and merchant control.                            |
| `scope-change-review`         | Flags access scopes added to a Shopify app manifest since the baseline for necessity review.                                    |
| `session-token-auth`          | Flags cookie or Web Storage identity state in embedded Shopify app code.                                                        |
| `settings-save-bar`           | Flags forms in embedded app pages that lack a contextual save bar integration.                                                  |
| `webhook-handler-review`      | Flags Shopify webhook handlers once per file for response-time, duplicate-delivery, ordering, uninstall, and compliance review. |

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

## Current rule contract

Rules expose `lifecycle`, `standard` (revision), `detector` (version), and `binding` (id, authority, scope, material options). Presets use arrays of bindings: `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`. Configure repeated uses with distinct binding ids. Repository owners choose scope and can raise authority to `human`; defaults permit agent acceptance. Acceptance requires matching current evidence and authority. `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser.

## Start with a focused review

The opt-in `starterPreset` includes `sessionTokenAuth`, `formErrorRecovery`. Install a compatible local draft of this package and agentlint, then run:

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-shopify-app#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` preserves an existing config and prints the package installation command. It never installs packages itself. Inspect and calibrate the bindings before making `agentlint check --all` required. This gradual onboarding takes conceptual inspiration from desloppify by Peter O'Malley; no code or guidance was copied.
