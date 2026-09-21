# Shopify contextual review research — 2026-09-05

The agentlint package adds seven review rules. Their tests establish trigger behavior and configuration boundaries. They do not establish an app's accessibility, merchant experience, truthful claims, security, or Shopify approval. The package remains a private draft tied to the reviewed local agentlint archive.

## Requirement mapping

The following mappings are partial, contextual coverage. Requirement identifiers refer to the official [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) and [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) inspected on this date.

| Review rule or area          | Related requirements                                          | What remains to demonstrate                                                                      |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `banner-usage`               | BFS 4.2.4, 4.3.3, 4.3.4, 4.3.6                                | Purpose, placement, competing states, dismissal across navigation/reload.                        |
| `form-error-recovery`        | BFS 4.2.4                                                     | Untouched, typing, blur, submit, failed request, correction, and accessible feedback states.     |
| `destructive-action-review`  | BFS 4.2.5, 4.3.3                                              | Actual impact, proportionate confirmation or undo, prevention of duplicate work, recovery.       |
| `modal-workflow-review`      | BFS 4.1.6, 4.3.3, 4.3.4; App Store 2.2.7                      | Entry paths, focused task, no nested modal workflow, usable dismissal.                           |
| `action-label-clarity`       | BFS 4.2.1, 4.2.5                                              | Predictable action in rendered context; translation and dynamic copy remain separate.            |
| `review-solicitation`        | BFS 4.3.2, 4.3.6; App Store 1.3.1, 2.2.6, 2.2.9, 5.6.2, 5.6.3 | Neutral wording, no incentive, permitted surface, voluntary participation.                       |
| `app-ux-review`: home        | BFS 3.1.4, 4.2.3                                              | Useful actual status/activity and theme activation state.                                        |
| onboarding                   | BFS 3.1.3, 4.2.2                                              | Fresh-install journey, required information, completion and dismissal.                           |
| navigation                   | BFS 3.1.2, 3.1.5, 4.1.1, 4.1.4; App Store 2.2.2               | Host navigation, direct routes, back behavior, embedded primary workflows.                       |
| responsive                   | BFS 4.1.1, 4.1.2                                              | Narrow/wide layouts, long content, keyboard/focus, contrast, stable rendering.                   |
| premium                      | BFS 4.3.7; App Store 1.2.2, 1.2.3                             | Actual entitlement states and accepted/declined plan changes.                                    |
| visual-editor                | BFS 4.1.5, 4.2.6, 4.3.4                                       | Visible live preview and preservation of dirty form state.                                       |
| checkout                     | App Store 1.1.9, 5.6.1–5.6.9                                  | Target behavior, buyer consent, data collection, chat eligibility, absent promotions/countdowns. |
| admin-extension              | App Store 2.2.5–2.2.7                                         | Useful complete functionality and merchant-controlled entry.                                     |
| sidekick                     | App Store 2.2.8, 2.2.9                                        | Consistency between declarations, listing, and actual tool behavior.                             |
| inputs, collections, content | Polaris component recommendations; BFS 4.2.1                  | Input units and server validation; useful real data volume; complete accessible text.            |
| copy-mechanics               | Shopify content guidelines; BFS 4.2.1                         | Grammar and formatting in actual locales, meaningful links, intentional exceptions.              |

`app-ux-review` uses a project-supplied filename/purpose mapping. It never infers app category or surface from names. Page targets need a matching JSX component; file targets intentionally review a configured extension entry point without JSX. A dormant default does not count as exercised coverage. Multiple targets can combine areas; independent page/file triggers retain their separate findings.

## Sources and decisions

The ten inspected non-component source snapshots are recorded locally in `.tmp/shopify-review/sources.json` with canonical URL, downloaded Markdown path, and SHA-256. The source policy records provenance; full Shopify prose remains outside versioned implementation. Component snapshots are in the separate component research inventory.

The [Banner reference](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner) explicitly leaves persistence to the app. A `dismissible` attribute therefore still schedules review. JSX grammar names and direct attributes prevent a quoted component name or prop example from masquerading as actual UI.

The [Alerts guide](https://shopify.dev/docs/apps/design/user-experience/alerts) prefers field errors after focus leaves the field, while the [Text field reference](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field) encourages feedback during typing. The review asks for actual state transitions and records this discrepancy. No syntactic ban on `onInput` or prescribed validation library is justified.

The [Switch reference](https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch) describes immediate application, while [Forms](https://shopify.dev/docs/apps/design/user-experience/forms) recommends an explicit save workflow for grouped edits. The inputs area distinguishes those purposes; a blanket rule requiring a Save Bar for every toggle would be misleading.

The [Color picker reference](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker) motivates precise keyboard input; [Tooltip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip) and [Paragraph](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph) motivate alternate access to hidden content. These need rendered interaction evidence. [Table](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table), [Choice list](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list), and [Menu](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu) suggest volume-dependent patterns; the review does not convert suggested counts into universal errors.

[Content](https://shopify.dev/docs/apps/design/content), [Marketing](https://shopify.dev/docs/apps/design/user-experience/marketing), [Onboarding](https://shopify.dev/docs/apps/design/user-experience/onboarding), [App Home](https://shopify.dev/docs/apps/design/user-experience/app-home-page), and [Navigation](https://shopify.dev/docs/apps/design/navigation) inform the relevant route areas. Copy lexicons are deliberately partial. No fixed reading level, sentence count, English capitalization rule, or unsupported guarantee of reader attention is applied across locales.

The broader source review adds [Voice and tone](https://shopify.dev/docs/apps/design/content/voice-and-tone), [Grammar and mechanics](https://shopify.dev/docs/apps/design/content/grammar-and-mechanics), and [App structure](https://shopify.dev/docs/apps/design/app-structure). The explicit `copy-mechanics` area reviews real locale output and preserves valid exceptions. Admin extension size recommendations require measuring rendered content and reviewing task complexity, rather than inspecting a CSS height literal.

## Existing guidance corrected

The dedicated [checkout performance guide](https://shopify.dev/docs/apps/build/checkout/extension-performance) treats `shopify.query()` as network work and recommends fetching necessary initial data before first paint, in the extension callback, while Shopify's skeleton remains. The broader [checkout best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps) set a network response-time target below one second and recommend initial skeletons without distinguishing host and extension rendering. The review follows the dedicated guide's explicit initial-data sequence and asks for measured response and rendering timings against the broader target. An earlier research pass incorrectly described that target as unsupported; the broader source establishes it as a checkout best practice. The trigger measures no latency and retains the prohibition on module-scope network initialization.

The [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api) informs direct `data-save-bar` recognition. Incidental `SaveBar` text no longer suppresses a form review; dynamic and false markers schedule review. Custom marker patterns remain explicit trusted configuration. Authentication keeps its public rule ID but uses the canonical [ID token documentation](https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens). Stateful custom regexes no longer alternate authentication or checkout findings.

## Validation and remaining evidence

Focused package build and typecheck passed. The package suite includes an actual draft agentlint CLI run over TSX and non-JSX extension fixtures. That integration checks all seven new rule IDs, direct attributes, harmless quoted component strings, clean-file silence, and per-file state reset. The final repository-wide validation records the complete counts after integration.

Live app behavior, production data, Partner Dashboard metrics, legal/account eligibility, listing accuracy, extension-category applicability, and real browser accessibility remain external evidence. No deployment, submission, publishing, or Shopify account mutation occurred.
