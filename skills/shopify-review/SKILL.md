---
name: shopify-review
description: Review a Shopify app against App Store, Built for Shopify, Polaris, copy, accessibility, and integration requirements, choosing the right lint, conformance, and runtime evidence per surface. Use when asked to review Shopify app readiness or quality, or before an App Store submission. Not for routine isolated edits.
---

# Shopify review

## Scope

- Read surfaces, distribution, deployment, versions, categories from the project. Each surface is its own contract: App Home components don't govern checkout, admin extensions, customer accounts, payments, Liquid.
- Official `shopify-app-store-review` skill/Dev MCP installed: use alongside, never instead (they check current requirements; this skill owns evidence and Harness tooling). Telemetry off (`DO_NOT_TRACK=1`, or toolkit opt-out file).
- Cite the exact [App Store](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements), [BFS](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements), [App Home](https://shopify.dev/docs/api/app-home/latest/web-components), or [design](https://shopify.dev/docs/apps/design) section before calling anything an error. Conflicts: record; examples aren't contracts.
- Harness only: `pnpm shopify:plan <profile.json>` lists pending items from `policy/shopify-requirements.json` (BFS includes App Store; unreviewed categories stay in); `pnpm shopify:sources` detects drift, never updates policy.

## Evidence owner

- Native HTML, Polaris: scoped lint; reuse upstream a11y rules, no prose regexes or copy autofix. App Home on older Polaris major or Polaris React: flag the restyle migration, check its current BFS deadline; 2.0 changes styles, not the component API.
- Manifest, extensions, built output: conformance, explicit deployment.
- Copy, UX: scoped agentlint or direct review; findings aren't approval. Headers, auth, webhooks, navigation, entitlements, keyboard, layout: app tests (webhook controls execute app behavior: isolated handlers, fixtures).

## Copy

Merchant task to outcome, consequence, next action (labels, recovery, translations included); [Voice](https://shopify.dev/docs/apps/design/content/voice-and-tone) per situation, [mechanics](https://shopify.dev/docs/apps/design/content/grammar-and-mechanics) per locale. Preserve names, quoted input, consent wording.

## Report

Defects, then evidence and gaps. Dashboard/submission/legal/live-store evidence stays unresolved. Green is not acceptance or BFS.
