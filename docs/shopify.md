# Shopify quality tooling

**Every App Store and Built for Shopify (BFS) requirement in the reviewed sources maps to an executable check or a named evidence protocol.**

```text
 App Store requirements     ████████████████████  174 / 174  mapped
 BFS requirements           ████████████████████   77 / 77   mapped
 App Home component pages   ████████████████████   50 / 50   tracked  (Polaris 1.1)
 + selected design, security, performance, Flow, Events, and listing guidance
```

**Polaris 2.0 is a restyle, not an API change.** It brings the refreshed admin's color, type, spacing, and icons; on 2026-09-24 the `@shopify/polaris-types` 2.0.0-rc.0 manifest listed the same components, attributes, events, and slots as 1.1. Adoption is explicit: switch the script to `polaris-2.0-rc.js` to test, then `polaris-2.js` once stable, with matching types (`polaris-cdn-track` enforces the pair and warns on RC channels). Shopify reports BFS apps must adopt the new design by 2027-05-01 ([announcement](https://community.shopify.dev/t/polaris-2-0-release-candidate/37957); not yet in the BFS requirements page). Fixed or sticky bottom UI uses `--shopify-safe-area-inset-bottom`. Known RC issue: the contextual save bar renders behind an open `s-app-window`.

[Source ledger](../policy/shopify-requirements.json): URLs, review dates, hashes, applicability, limits. Review began 2026-09-05; sources added later carry their own date.

> [!WARNING]
> **Nothing here grants App Store approval or BFS status**: not the ledger, complete inventories, or green tests. Shopify's review and deployment systems decide.

## Choose the evidence owner

**Scope to what the app ships:** distribution, deployment, component versions, categories, surfaces (each its own contract).

```text
 App Home web components │ checkout extensions │ admin extensions
 customer accounts       │ Functions           │ storefront themes
```

| Need                                                                                   | Tool                                                                          | A pass establishes                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| Polaris components known to installed types, labels, action slots, modals, API calls   | [27 Oxlint rules](../packages/oxlint-plugin-shopify-app/README.md)            | source meets the configured static contract |
| native HTML accessibility                                                              | [App Home Oxlint recipe](../examples/shopify/app-home.oxlintrc.json)          | `jsx-a11y` on native elements               |
| copy, recovery, destructive actions, onboarding, navigation, checkout UX, Flow actions | [15 agentlint reviews](../packages/agentlint-plugin-shopify-app/README.md) 🔒 | review work found, not a verdict            |
| manifests, API versions, Polaris CDN major, Flow templates, Preact migration, bundles  | [13 conformance checks](../packages/conformance-shopify-app/README.md)        | local inputs meet their contract            |
| iframe protection, webhook rejection                                                   | conformance HTTP helpers                                                      | supplied handler passes tested scenarios    |
| admin, carrier, fulfillment, storefront performance                                    | conformance performance evaluators                                            | supplied measurements meet thresholds       |
| app-wide applicability, missing evidence                                               | [Shopify review skill](../skills/shopify-review/SKILL.md) + planner           | scope + pending work, never acceptance      |

Oxlint + conformance: public-registry consumer validation. Agentlint: packed-consumer and registry validation on the public engine 0.3.x ([contract](agentlint-contract.md)).

## Shopify's own agent tooling complements this review

**Use Shopify's official tools alongside Harness, never instead of evidence: they check against Shopify's current docs; Harness owns evidence and drift.** Reviewed 2026-09-24.

| Tool                                                                                                         | Adds                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) `shopify-app-store-review` skill                | requirement-by-requirement pre-submission pass, maintained by Shopify                     |
| [Dev MCP](https://shopify.dev/docs/apps/build/ai-toolkit#install-with-the-dev-mcp-server) `@shopify/dev-mcp` | doc search, GraphQL and Polaris component validation for the surface and version          |
| `shopify app config validate` · `shopify app deploy`                                                         | Shopify's TOML schemas and deploy limits; needs a registered app, so no offline preflight |

> [!IMPORTANT]
> **Telemetry always off.** The AI Toolkit and Dev MCP send usage events by default, including prompts and validated code ([toolkit README](https://github.com/Shopify/Shopify-AI-Toolkit#telemetry)). Create the opt-out file (`%APPDATA%\shopify-ai-toolkit\opt-out` on Windows, `~/.config/shopify-ai-toolkit/opt-out` elsewhere) and set `DO_NOT_TRACK=1`: the file also covers hosts that drop your environment.

## Adopt in 5 steps

**1 → Lint App Home** with the [recipe](../examples/shopify/app-home.oxlintrc.json)'s plugin and rule entries. **Omit its `categories.correctness: "off"`** (fixture-only).

**2 → Gate policy rules on applicability.** `no-script-tag-api` always: **Script Tags shut down on 2027-03-01.** The rest: table below.

**3 → Add conformance:** `shopifyAppConformance` in Vitest, or `runShopifyAppConformanceReport`, configured per the [package examples](../packages/conformance-shopify-app/README.md). **Missing evidence stays visible.**

**4 → HTTP + performance helpers in app-owned tests.** Perf helpers **don't collect or authenticate telemetry.**

> [!CAUTION]
> **The webhook probe sends a valid signed control, which can execute app behavior.** Use isolated handlers, fixture data, and a fixture signing secret. Test every relevant route and privacy topic.

**5 → Target contextual review:** `app-ux-review` with route or entry-file targets and purposes; default instance dormant.

<details>
<summary>Step details and the applicability table</summary>

- Step 1: scope entries to App Home source; check prop types against Shopify's component declarations for the actual surface and version.
- Step 3: select a deployment explicitly when dev and prod configs differ; configure document entries, reviewed API-version bounds, category prerequisites, optional listing inputs.
- Step 5: narrow targets keep copy and interaction questions close to the work instead of an app-wide audit on every edit.

| Rule                                                                                                     | Enable when                                                              |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| server + API baseline (`userErrors`, idempotent mutations, thrown auth, billing test mode, webhook HMAC) | per the [plugin README](../packages/oxlint-plugin-shopify-app/README.md) |
| `no-admin-rest-api`                                                                                      | new public-app GraphQL policy only                                       |
| `no-asset-api-theme-writes`, `no-draft-order-custom-discounts`                                           | category + distribution apply                                            |
| `functions-no-unavailable-runtime-apis`                                                                  | Function directories, via `overrides`                                    |
| `require-fetch-abort-signal`                                                                             | relevant checkout extension paths                                        |
| `app-ux-review`, `scope-change-review` (agentlint)                                                       | ⚙️ opt-in, in no preset                                                  |
| `extension-capability-contract`, `listing-inputs` (conformance)                                          | ⚙️ opt-in: pass `optionalShopifyAppChecks`                               |
| `[events]` checks: `nextGenerationEvents: true` (conformance)                                            | ⚙️ opt-in while Events is a developer preview on `unstable`              |
| `builtForShopifyCategories: ["returns" \| "subscriptions"]` (conformance)                                | Customer Account API prerequisite (BFS 5.12.4 / 5.14.5, from 2026-12-01) |

</details>

## The planner prints pending work, never approval

Harness repo only, after dependency setup; the skill installs nothing into apps.

```sh
pnpm shopify:plan examples/shopify/review-profile.json   # print the review plan
pnpm build                                               # shopify:check imports built exports
pnpm shopify:check                                       # one disposition per requirement
pnpm test:shopify-policy                                 # planner + policy unit tests
pnpm shopify:sources                                     # network drift check
```

```mermaid
flowchart LR
  P["review-profile.json"] --> C["pnpm shopify:plan"]
  C --> J["JSON, status unreviewed"]
  J --> E[attach app evidence]
  E --> R[actual review process]
```

Output: pending items, official links, evidence instructions, partial tooling boundaries. **It runs no checks.** Adapt the [example profile](../examples/shopify/review-profile.json):

- `programs`: App Store and/or BFS. **BFS always includes App Store prerequisites.**
- `categories`: per program. Omitted → all until triaged; `[]` → general requirements only.
- `surfaces`: optional; narrows supporting guidance, never numbered requirements.

## A drift check keeps the ledger honest

`shopify:check` fails on a missing/duplicate disposition or a tool absent from the build, so **rebuild first**. `shopify:sources` fails on changed official Markdown, added/removed IDs, redirects, or unavailable sources; network-only, outside the local gate. **It never rewrites reviewed policy**: changed prose needs review even with unchanged IDs.

## Where Shopify's guidance conflicts, Harness schedules review

**No blanket error where the sources disagree or depend on context. A static abort signal is not a response-time budget.**

<details>
<summary>The four decisions and the checkout sources</summary>

| Guidance                        | Decision                                                         |
| ------------------------------- | ---------------------------------------------------------------- |
| Page breadcrumb, Select options | conflicting in the component audit: ❌ no blanket error          |
| Text field vs Alerts timing     | review untouched, typing, blur, submit, recovery                 |
| image descriptions              | purpose-dependent: ❌ no English prefix rule                     |
| checkout network                | record integration + measured latency; ❌ no pre-paint fetch ban |

Checkout network: [General App Store best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps): sub-second checkout network target, initial skeletons. [Dedicated checkout performance guide](https://shopify.dev/docs/apps/build/checkout/extension-performance): load required data in the extension callback before first paint so Shopify keeps its own skeleton. A blanket pre-paint fetch ban would contradict the dedicated guide.

</details>

## Static tooling stops where app behavior starts

```text
 visual contrast        keyboard behavior       readable copy
 permissions necessity  billing and consent     privacy processing
 category workflows     merchant metrics        submission evidence
```

**These need app-specific browser/runtime evidence.**

<details>
<summary>Attribution</summary>

The implementation is independently authored. Greppable `@attribution` comments and package README credits identify adopted concepts. Official documentation is linked and hashed in the governed source manifest; no copied documentation corpus ships.

</details>
