---
name: shopify-review
description: Review Shopify app readiness or improve its App Store, Built for Shopify, Polaris, copy, accessibility, and integration evidence. Use for requested Shopify quality work; a routine isolated app edit does not require a full platform audit.
---

# Shopify review

Establish the app's surfaces, distribution model, deployment manifest, API/component versions and applicable categories from the project. An App Home component contract does not automatically apply to checkout, admin extensions, customer accounts, payments or storefront Liquid. Preserve explicit project exceptions and the user's authorization, including restrictions on publishing and deployment.

Use current official requirements: [App Store](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements), [Built for Shopify](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements), [App Home components](https://shopify.dev/docs/api/app-home/latest/web-components), and [design guidance](https://shopify.dev/docs/apps/design). Check the exact source section before turning a recommendation into an error. Category exceptions, supported versions and examples can disagree; record the conflict instead of treating an example as a universal contract.

When working in Harness, `policy/shopify-requirements.json` maps the reviewed sources to executable tools and remaining evidence. `pnpm shopify:plan <profile.json>` creates pending review items; `pnpm shopify:sources` detects source drift without updating the policy. A BFS plan includes App Store prerequisites. Unspecified categories remain included until applicability is reviewed. In other repositories, use installed Harness packages and the official sources; do not assume these repository scripts are installed with a skill.

Use the smallest evidence owner that can establish the claim:

- Native HTML and Polaris source contracts belong to the app's scoped lint configuration. Reuse upstream accessibility rules and component types; avoid enforcing prose with broad regexes or rewriting translated text automatically.
- Manifest, extension and built-output requirements belong to conformance with explicit deployment and entry selection. Finding a script, scope, extension or URL cannot establish its runtime behavior.
- Contextual copy and UX questions belong to scoped agentlint review or a direct review. Agentlint findings schedule judgment; accepting a finding is not Shopify approval. Inspect the package's release boundary before installing a private preview.
- Served headers, authentication, webhooks, navigation, entitlements, keyboard interaction and responsive layouts need actual app tests. Use isolated handlers and test fixtures for webhook probes; valid controls may execute application behavior. Follow existing authorization for external or live actions.
- Performance needs the correct app, population, statistic, measurement window and provenance. Missing traffic is incomplete evidence. Keep local observations distinct from Shopify dashboard assessment.

For copy, start with the merchant's task and state. Give the outcome, consequence and next useful action. Check labels, recovery messages and translations where they appear. Apply the [voice guidance](https://shopify.dev/docs/apps/design/content/voice-and-tone) to the situation and [mechanics](https://shopify.dev/docs/apps/design/content/grammar-and-mechanics) to the actual locale; English capitalization and punctuation are not universal language rules. Preserve proper names, quoted input, consent wording and meaningful detail. Do not claim that a writing style guarantees attention or suits every neurodivergent reader.

Report confirmed defects first, then the evidence supporting the result and material gaps. Identify the revision, environment and applicability of recorded results. Keep unavailable dashboard, submission, legal/business and live-store evidence unresolved. A complete requirement inventory or a green local gate establishes neither App Store acceptance nor Built for Shopify status.

<!-- @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently authored review workflow) -->
<!-- @attribution https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently authored review workflow) -->
<!-- @attribution https://shopify.dev/docs/apps/design/content (inspiration; independently authored review workflow) -->
