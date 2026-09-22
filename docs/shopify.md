# Shopify quality tooling

Harness maps all 174 App Store requirements and 77 Built for Shopify requirements in the reviewed source pages to executable checks or a named evidence protocol. It also tracks all 47 App Home component pages and selected design, security, performance, and listing guidance. The [source ledger](../policy/shopify-requirements.json) records URLs, review dates, content hashes, applicability, and limits; it does not record an app's acceptance.

Start with the app's actual distribution, deployment, surfaces, component versions, and categories. App Home web components, checkout extensions, admin extensions, customer accounts, Functions, and storefront themes have different contracts. The source review began on September 5, 2026; keep the ledger current using the drift check below.

## Choose the evidence owner

| Need                                                                                              | Tool                                                                         | What a passing result establishes                                                            |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Polaris labels, action slots, modal structure, recognized API calls, server and GraphQL contracts | [27 Oxlint rules](../packages/oxlint-plugin-shopify-app/README.md)           | The inspected source forms satisfy the configured static contract.                           |
| Native HTML accessibility                                                                         | [App Home Oxlint recipe](../examples/shopify/app-home.oxlintrc.json)         | Existing `jsx-a11y` rules check native elements alongside Polaris rules.                     |
| Copy, recovery, destructive actions, onboarding, navigation, checkout UX                          | [14 agentlint reviews](../packages/agentlint-plugin-shopify-app/README.md)   | Deterministic triggers identify contextual review work. Findings need evidence and judgment. |
| Deployment manifests, API versions, extension prerequisites, built bundles, listing assets        | [10 conformance checks](../packages/conformance-shopify-app/README.md)       | Selected local inputs satisfy their structural or quantitative contract.                     |
| Iframe protection and webhook rejection                                                           | Explicit HTTP helpers in the conformance package                             | A supplied response or isolated handler passes the tested scenarios.                         |
| Admin, carrier, fulfillment, and storefront performance                                           | Explicit performance evaluators in the conformance package                   | Supplied measurements meet the selected thresholds and input requirements.                   |
| App-wide applicability and missing evidence                                                       | [Shopify review skill](../skills/shopify-review/SKILL.md) and review planner | The review has an explicit scope and pending work; no acceptance is inferred.                |

The agentlint plugins use the migrated draft contract and remain private. Follow their [current package instructions](../packages/agentlint-plugin-shopify-app/README.md) and [contract](agentlint-contract.md); the local and public agentlint archives share a version number but expose incompatible APIs. The Oxlint and conformance packages have separate public-registry consumer validation.

## Adopt incrementally

Copy the plugin and rule entries from the [App Home recipe](../examples/shopify/app-home.oxlintrc.json) into the project's lint configuration and scope them to App Home source. Preserve the project's categories map: omit the recipe's `categories.correctness: "off"`, which isolates its focused consumer fixture. Use Shopify's component declarations for the actual surface and version to check prop types.

Enable `no-admin-rest-api` only for the new public-app GraphQL policy. Enable theme-write and draft-order discount restrictions after checking category and distribution applicability. `no-script-tag-api` belongs in the baseline: Script Tags shut down on 2027-03-01. The server and API baseline (`userErrors` selection, idempotent mutations, thrown auth responses, billing test mode, webhook HMAC shape) is listed in the plugin README; scope `functions-no-unavailable-runtime-apis` to Function source directories with `overrides`. Three agentlint reviews and one conformance check are opt-in. Apply fetch cancellation to the relevant checkout extension paths. These decisions require knowledge that a source filename alone cannot establish.

Add `shopifyAppConformance` to Vitest or call `runShopifyAppConformanceReport`. Select a deployment explicitly where development and production configurations differ. Configure document entries, reviewed API-version bounds, category prerequisites, and optional listing inputs using the [package examples](../packages/conformance-shopify-app/README.md). Missing supplied evidence must stay visible in the resulting review.

Use the HTTP and performance helpers explicitly in app-owned tests. The webhook probe calls a valid signed control, which can execute application behavior: supply isolated handlers, fixture data, and a fixture signing secret. Test all relevant routes and privacy topics. Performance helpers validate aggregates and comparisons supplied by the caller; they do not collect or authenticate telemetry.

For contextual review, configure `app-ux-review` with known route or entry-file targets and their purposes. Its default instance is dormant. Narrow targets keep useful copy and interaction questions close to the work without making every edit trigger an app-wide audit.

## Plan and maintain coverage

These commands run in the Harness repository after dependency setup; the skill does not install them into consuming apps. `shopify:check` imports built exports, so rebuild after changing rules or starting from an unbuilt checkout.

```sh
pnpm shopify:plan examples/shopify/review-profile.json
pnpm build
pnpm shopify:check
pnpm test:shopify-policy
pnpm shopify:sources
```

Copy and adapt the [example profile](../examples/shopify/review-profile.json). `programs` selects App Store and/or BFS; a BFS plan always includes App Store prerequisites. `categories` is a separate list for each program. Omitted categories include every category until triaged; an explicit empty list retains general requirements only. Optional `surfaces` narrows supporting guidance, while numbered requirements remain governed by program and category.

The planner prints JSON with `status: "unreviewed"` and pending items, official links, evidence instructions, and partial tooling boundaries. It neither runs the checks nor turns their results into approval. Attach app-owned results and external evidence to the actual review process.

`shopify:check` verifies every source requirement has exactly one disposition and every referenced Harness tool exists in built exports. `shopify:sources` fetches official Markdown and fails on content changes, added or removed IDs, redirects, or unavailable sources. It never rewrites reviewed policy. Network drift checking is separate from the reproducible local gate; changed prose needs review even when requirement IDs stay the same.

## Source decisions that affect enforcement

The component audit found conflicts within the Page breadcrumb and Select option-content guidance. Neither became a blanket error. Text-field and Alerts guidance differs on validation timing, so review exercises untouched, typing, blur, submit, and recovery states. Image descriptions depend on purpose; a generic English prefix rule cannot establish useful alternative text.

The [general App Store best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps) describe a sub-second checkout network target and initial skeletons. The [dedicated checkout performance guide](https://shopify.dev/docs/apps/build/checkout/extension-performance) explains loading required data in the extension callback before first paint so Shopify can keep its own skeleton visible. Record the integration and measured latency; a blanket ban on pre-paint fetching would contradict the dedicated guide. A static abort signal does not establish a response-time budget.

Visual contrast, keyboard behavior, readable copy, permissions necessity, billing and consent, privacy processing, category-specific workflows, merchant metrics, and submission evidence need app-specific observations. Inventory completeness and local green tests cannot grant App Store approval or Built for Shopify status. Shopify's review and deployment systems remain authoritative.

The implementation is independently authored. Greppable `@attribution` comments and package README credits identify adopted concepts. Official documentation is linked and hashed in the governed source manifest, with no copied documentation corpus shipped. Deterministic requirements live in `policy/shopify-requirements.json`; app-owned behavior still requires browser/runtime evidence.
