# Shopify App Harness Rule Ledger

Created: 2026-06-30

Purpose: temporary working ledger for turning Shopify docs into enforceable OSS harness rules. Update `Status`, `Decision`, and `Notes` as we tune each candidate.

Status values:

- `todo`: not reviewed together yet
- `active`: currently being discussed
- `done`: accepted for implementation with a clear trigger
- `postponed`: valid, but later
- `skipped`: valid guidance, but not worth automating now
- `rejected`: not enforceable, too noisy, duplicate, or not source-grounded enough

Enforcement values:

- `oxlint`: AST/static code rule
- `agentlint`: deterministic trigger plus review instruction
- `config`: manifest/package/build/file-structure rule
- `e2e`: Playwright/axe/Lighthouse/runtime test
- `monitor`: production or CI performance/SLO monitor
- `preset`: bundle/enable existing rules

## Source Inventory

| Key | Source |
| --- | --- |
| BFS | https://shopify.dev/docs/apps/launch/built-for-shopify/requirements |
| App Store Best Practices | https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices |
| App Home Patterns | https://shopify.dev/docs/api/app-home/patterns |
| App Home Account Connection | https://shopify.dev/docs/api/app-home/patterns/compositions/account-connection |
| App Home Empty State | https://shopify.dev/docs/api/app-home/patterns/compositions/empty-state |
| App Home Footer Help | https://shopify.dev/docs/api/app-home/patterns/compositions/footer-help |
| App Home Metrics Card | https://shopify.dev/docs/api/app-home/patterns/compositions/metrics-card |
| App Home Setup Guide | https://shopify.dev/docs/api/app-home/patterns/compositions/setup-guide |
| App Home Details | https://shopify.dev/docs/api/app-home/patterns/templates/details |
| App Home Homepage | https://shopify.dev/docs/api/app-home/patterns/templates/homepage |
| App Home Index | https://shopify.dev/docs/api/app-home/patterns/templates/index |
| App Home Settings | https://shopify.dev/docs/api/app-home/patterns/templates/settings |
| Polaris React Patterns | https://polaris-react.shopify.com/patterns |
| Polaris React Card Layout | https://polaris-react.shopify.com/patterns/card-layout |
| Polaris React Common Actions | https://polaris-react.shopify.com/patterns/common-actions |
| Polaris React Date Picking | https://polaris-react.shopify.com/patterns/date-picking |
| Polaris React New Features | https://polaris-react.shopify.com/patterns/new-features |
| Polaris React Legacy Loading | https://polaris-react.shopify.com/patterns-legacy/loading |
| Polaris React Legacy New Badge | https://polaris-react.shopify.com/patterns-legacy/new-badge |
| Polaris React Legacy Pickers | https://polaris-react.shopify.com/patterns-legacy/pickers |
| Polaris React Legacy Text Fields | https://polaris-react.shopify.com/patterns-legacy/text-fields |
| Checkout Extension Performance | https://shopify.dev/docs/apps/build/checkout/extension-performance |
| General Performance | https://shopify.dev/docs/apps/build/performance/general-best-practices |
| Accessibility | https://shopify.dev/docs/apps/build/accessibility |
| Privacy Requirements | https://shopify.dev/docs/apps/launch/privacy-requirements |
| Mobile Support | https://shopify.dev/docs/apps/build/mobile-support |
| Integrating with Shopify | https://shopify.dev/docs/apps/build/integrating-with-shopify |
| Function Localization | https://shopify.dev/docs/apps/build/functions/localization-practices-shopify-functions |
| Post-Purchase Subscriptions UX | https://shopify.dev/docs/apps/build/checkout/product-offers/ux-for-post-purchase-subscriptions |
| Post-Purchase Product Offers UX | https://shopify.dev/docs/apps/build/checkout/product-offers/ux-for-post-purchase-product-offers |

## Package / Preset Shape

| Package or preset | Purpose |
| --- | --- |
| `shopify-app-core` | Admin integration, Shopify APIs, extensions, privacy, performance, storefront, checkout, post-purchase, Functions. |
| `shopify-polaris-web-components` | Static rules for Polaris web components, App Bridge web components, and their supported React wrappers such as `@shopify/app-bridge-react`. |
| `shopify-polaris-react` | Static and review rules for legacy Polaris React apps. |
| `shopify-a11y` | Reusable accessibility checks for Shopify app and storefront surfaces. |
| `shopify-performance` | General app, storefront, and checkout performance rules. |
| `shopify-bfs` | Preset that enables BFS-relevant rules from the implementation packages. |

## Rule Candidates

| ID | Status | Package | Enforcement | Source | Rule | Trigger sketch | Decision | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SHOP-001 | done | shopify-app-core, shopify-bfs | oxlint, config | BFS 3.1.1, App Store Best Practices, App Home APIs | require-app-bridge-script | Embedded app root/layout document lacks Shopify App Bridge script in head. | Implement as document-entry rule. Pass when embedded app document head contains `https://cdn.shopify.com/shopifycloud/app-bridge.js`, or when a configured/known platform placeholder is present that injects it at serve time. Fail when only React/provider imports exist. | Accepted 2026-06-30. Must support static `index.html` and SSR document roots for Remix, React Router framework, TanStack Router/Start, and similar root layout files. `@shopify/app-bridge-react` docs say to include the script tag; its hook throws when the `shopify` global is missing. Gadget provider also expects `globalThis.shopify` and throws in embedded admin context when missing. KeepCart has `<!-- GADGET_CONFIG -->`, so support platform injector allowances such as Gadget instead of hard-failing every missing literal script. |
| SHOP-002 | todo | shopify-app-core, shopify-bfs | agentlint, oxlint | BFS 3.1.1, App Store Best Practices | require-session-token-auth | Embedded auth/fetch/session code uses cookie/localStorage/OAuth-only session without App Bridge session token flow. |  |  |
| SHOP-003 | todo | shopify-app-core | oxlint | App Store Best Practices | no-essential-popup-flow | Essential auth, billing, or approval flow uses `window.open`, popup OAuth, or popup charge approval. |  |  |
| SHOP-004 | todo | shopify-app-core | oxlint, agentlint | App Store Best Practices | no-third-party-cookie-auth | Embedded app auth/session modules rely on third-party cookies or localStorage for identity/session. |  |  |
| SHOP-005 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 3.1.2, Integrating with Shopify | primary-workflows-in-admin | Primary CTA, route, or redirect sends merchant to external surface for core workflow. |  |  |
| SHOP-006 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 3.1.5, Integrating with Shopify | third-party-settings-in-admin | Third-party connect/disconnect code exists without embedded admin settings UI. |  |  |
| SHOP-007 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 3.1.1 | no-external-embedded-pages | Embedded app home or primary route renders external iframe/page as the app surface. |  |  |
| SHOP-008 | todo | shopify-app-core | agentlint | Integrating with Shopify | no-extra-self-service-login | Self-service installed app asks for separate login/signup before merchant can use it. |  |  |
| SHOP-009 | todo | shopify-app-core | agentlint | Integrating with Shopify | homepage-simplified-reporting | App has external dashboard/reporting but no simplified embedded home metrics/status. |  |  |
| SHOP-010 | todo | shopify-app-core, shopify-bfs | config, agentlint | BFS 3.2.1, App Store Best Practices | storefront-ui-uses-theme-app-extension | Storefront UI/injection code exists without theme app extension manifest. |  |  |
| SHOP-011 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 3.2.2 | no-asset-api-theme-writes | Theme Asset API or theme file create/update/delete calls, except configured category exemptions. |  |  |
| SHOP-012 | todo | shopify-app-core | oxlint, config | App Store Best Practices | storefront-attribution-size | Storefront attribution/logo exceeds 24x24 without interactive exception. |  |  |
| SHOP-013 | todo | shopify-app-core | agentlint | App Store Best Practices | storefront-no-review-or-cross-promo-branding | Storefront branding requests reviews/ratings or promotes other apps/services. |  |  |
| SHOP-014 | todo | shopify-app-core, shopify-bfs | config, agentlint | BFS 5.1, 5.2, 5.3, 5.6, 5.13 | web-pixel-required-for-tracking | Tracking app uses script tag/copy-paste JS instead of Web Pixel extension. |  |  |
| SHOP-015 | todo | shopify-app-core, shopify-bfs | config | BFS 5.1, 5.6, 5.7, 5.13 | customer-segment-action-required | Customer targeting app lacks customer segment action extension. |  |  |
| SHOP-016 | todo | shopify-app-core, shopify-bfs | oxlint, config | BFS 5.6, 5.7, 5.13 | visitors-api-for-identification | Storefront email/phone identification lacks Visitors API logging path. |  |  |
| SHOP-017 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.5.1 | discount-primitives-required | Discount app uses custom checkout/cart workaround without Shopify discount primitives. |  |  |
| SHOP-018 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 5.5.2 | no-draft-order-custom-discounts | `draftOrderCreate` or `draftOrderUpdate` includes custom discount input. |  |  |
| SHOP-019 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 5.5.3 | bulk-redeem-code-add-required | Code loops/arrays create many discount codes without `discountRedeemCodeBulkAdd`. |  |  |
| SHOP-020 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.5.4 | discount-create-links-embedded | Discount create links go external or not to corresponding embedded creation route. |  |  |
| SHOP-021 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.8.4 | fulfillment-after-merchant-request | Fulfillment creation is not gated by merchant fulfillment request/accepted state. |  |  |
| SHOP-022 | todo | shopify-app-core, shopify-bfs | oxlint, agentlint | BFS 5.8.5 | fulfillment-tracking-info-required | Fulfillment mutation lacks tracking company/url or follow-up tracking update path. |  |  |
| SHOP-023 | todo | shopify-app-core, shopify-bfs | config | BFS 5.9.1 | admin-print-action-extension-required | Invoice or packing-slip app lacks admin print action extension manifest. |  |  |
| SHOP-024 | todo | shopify-app-core, shopify-bfs | config, agentlint | BFS 5.10.1 | bundle-primitives-required | Bundle app lacks static bundle API or cart transform function. |  |  |
| SHOP-025 | todo | shopify-app-core, shopify-bfs | config | BFS 5.11.1 | review-flow-trigger-required | Product review app lacks Flow trigger extension. |  |  |
| SHOP-026 | todo | shopify-app-core, shopify-bfs | config | BFS 5.11.2 | review-customer-block-required | Product review app lacks customer detail admin block extension. |  |  |
| SHOP-027 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.12.1 | returns-lifecycle-api-coverage | Returns app lacks create, shipping, restock, remove, cancel, close, or refund lifecycle API coverage. |  |  |
| SHOP-028 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.12.2 | exchange-lines-required | Exchange flow lacks exchange line item creation/removal API coverage. |  |  |
| SHOP-029 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.12.3 | returns-fees-modeled | Return/exchange fees exist in app data but no Shopify fee mutation path. |  |  |
| SHOP-030 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.12.4 | returns-customer-account-api | Customer-facing returns auth uses app account/password instead of Customer Account API. |  |  |
| SHOP-031 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 5.14.1 | subscription-apis-required | Subscription app lacks selling plan, subscription contract, or customer payment method API usage. |  |  |
| SHOP-032 | todo | shopify-app-core, shopify-bfs | config | BFS 5.14.2 | subscription-theme-app-block | Product-page subscription UI lacks OS 2.0 app block extension. |  |  |
| SHOP-033 | todo | shopify-app-core, shopify-bfs | e2e | BFS 5.14.3 | subscription-info-visible | Product/cart/order pages lack selling plan name, price, or savings display. |  |  |
| SHOP-034 | todo | shopify-app-core | e2e | App Store Best Practices 17 | post-purchase-redirect-confirmation | Post-purchase flow does not redirect to order confirmation after response. |  |  |
| SHOP-035 | todo | shopify-app-core | oxlint, agentlint | App Store Best Practices 17 | post-purchase-max-three-offers | Offer flow can show more than three consecutive offers. |  |  |
| SHOP-036 | todo | shopify-app-core | e2e | App Store Best Practices 17 | post-purchase-clear-accept-decline-options | Offer UI lacks clear accept and decline paths. |  |  |
| SHOP-037 | todo | shopify-app-core | e2e | App Store Best Practices 17 | post-purchase-price-transparent | Quantity/variant changes do not update price or price differs from store price. |  |  |
| SHOP-038 | todo | shopify-app-core | agentlint | App Store Best Practices 17 | post-purchase-no-tracking-status-promo | Post-purchase UI renders tracking/status/third-party promotion copy/components. |  |  |
| SHOP-039 | todo | shopify-app-core | oxlint | App Store Best Practices 18 | checkout-documented-apis-only | Checkout extension imports or calls undocumented checkout surfaces. |  |  |
| SHOP-040 | todo | shopify-app-core | agentlint | App Store Best Practices 18 | checkout-no-payment-info-collection | Checkout UI extension fields ask for card/payment/bank information. |  |  |
| SHOP-041 | todo | shopify-app-core, shopify-bfs | oxlint, agentlint | App Store Best Practices 18, BFS 4.3.2 | checkout-no-countdown-timers | Countdown/timer component or urgency copy appears in checkout extension. |  |  |
| SHOP-042 | todo | shopify-app-core | agentlint | App Store Best Practices 18 | checkout-no-duplicate-standard-fields | Checkout UI extension collects information standard checkout already captures. |  |  |
| SHOP-043 | todo | shopify-app-core | oxlint, agentlint | App Store Best Practices 18 | checkout-network-skeleton-first | Checkout extension uses network access but initial render lacks skeleton/loading placeholder. |  |  |
| SHOP-044 | todo | shopify-app-core | monitor | App Store Best Practices 18 | checkout-network-under-one-second | Checkout extension network endpoint exceeds 1s target/budget. |  |  |
| SHOP-045 | todo | shopify-app-core | agentlint | App Store Best Practices 18 | checkout-no-self-promotion | Checkout extension copy/logo/link promotes app/company unrelated to buyer task. |  |  |
| SHOP-046 | todo | shopify-app-core | e2e | App Store Best Practices | optional-charge-off-by-default | Optional fee/product/checkout checkbox is checked by default or auto-adds line item. |  |  |
| SHOP-047 | todo | shopify-app-core | e2e | App Store Best Practices | optional-charge-itemized | Optional charge changes total without visible itemized disclosure. |  |  |
| SHOP-048 | todo | shopify-app-core | e2e | App Store Best Practices | shipping-default-lowest-price | Delivery customization/carrier rates default to non-cheapest shipping option. |  |  |
| SHOP-049 | todo | shopify-performance | oxlint | Checkout Extension Performance | checkout-no-load-time-external-network | Checkout extension startup does external network work before first render. |  |  |
| SHOP-050 | todo | shopify-performance | oxlint, agentlint | Checkout Extension Performance | checkout-prefer-shopify-data-apis | Checkout extension fetches app/server config instead of metafields, metaobjects, settings, checkout APIs, or localization APIs. |  |  |
| SHOP-051 | todo | shopify-performance | oxlint | Checkout Extension Performance | checkout-require-network-timeout | Checkout extension network call lacks timeout via AbortSignal, Promise race, or configured wrapper. |  |  |
| SHOP-052 | todo | shopify-performance | oxlint | Checkout Extension Performance | checkout-parallelize-independent-requests | Independent fetch/query calls are awaited sequentially before render. |  |  |
| SHOP-053 | todo | shopify-performance | oxlint | Checkout Extension Performance | checkout-no-initial-data-fetch-in-effect | Initial checkout data is fetched in `useEffect` instead of pre-render path/skeleton. |  |  |
| SHOP-054 | todo | shopify-performance | oxlint | Checkout Extension Performance | checkout-no-expensive-module-scope | Checkout extension module scope does network, large parse, schema validation, SDK init, regex/config parsing. |  |  |
| SHOP-055 | todo | shopify-performance | oxlint | Checkout Extension Performance | checkout-read-signals-in-leaf-components | `shopify.*.value` signal is read in root/container component that renders unrelated children. |  |  |
| SHOP-056 | todo | shopify-performance | oxlint, config | Checkout Extension Performance | checkout-no-heavy-utility-imports | Checkout extension imports heavy helper libraries such as moment, dayjs, lodash, ramda. |  |  |
| SHOP-057 | todo | shopify-performance | oxlint, config | Checkout Extension Performance | checkout-no-bundled-i18n-runtime | Checkout extension bundles i18n runtime where Shopify localization APIs should be used. |  |  |
| SHOP-058 | todo | shopify-performance | oxlint | Checkout Extension Performance | checkout-no-large-static-data | Large arrays/objects/string blobs embedded in checkout extension source. |  |  |
| SHOP-059 | todo | shopify-performance | config | Checkout Extension Performance | checkout-bundle-budget-metafile-required | Checkout extension build lacks esbuild metafile or bundle size budget check. |  |  |
| SHOP-060 | todo | shopify-performance | oxlint | General Performance | performance-viewport-meta-required | App root document lacks responsive viewport meta tag. |  |  |
| SHOP-061 | todo | shopify-performance | oxlint | General Performance | performance-no-parser-blocking-script | External script tag lacks `defer`, `async`, or module semantics. |  |  |
| SHOP-062 | todo | shopify-performance | config | General Performance | performance-no-storefront-framework-bundle | Storefront app asset imports large frontend framework bundle. |  |  |
| SHOP-063 | todo | shopify-performance | config | General Performance | performance-no-legacy-polyfill-bundle | Storefront/embed imports `core-js`, `regenerator-runtime`, or broad legacy polyfills. |  |  |
| SHOP-064 | todo | shopify-performance | config | General Performance | performance-storefront-js-budget-16kb | Minified storefront/app embed JS exceeds 16 KB. |  |  |
| SHOP-065 | todo | shopify-performance | config | General Performance | performance-entrypoint-budget-10kb-js-50kb-css | App entrypoint exceeds 10 KB JS or 50 KB CSS budget. |  |  |
| SHOP-066 | todo | shopify-performance | oxlint | General Performance | performance-iife-wrap-global-script | Non-module storefront script emits top-level globals outside IIFE. |  |  |
| SHOP-067 | todo | shopify-performance | oxlint, agentlint | General Performance | performance-load-noncritical-on-interaction | Heavy optional widgets/charts/modals are statically imported in initial storefront entry. |  |  |
| SHOP-068 | todo | shopify-performance | oxlint | General Performance | performance-inline-script-before-remote-css | HTML/Liquid includes remote stylesheet before inline script tags. |  |  |
| SHOP-069 | todo | shopify-a11y | config | Accessibility | a11y-axe-check-required | UI project has routes/components but no axe/Lighthouse/accessibility CI check. |  |  |
| SHOP-070 | todo | shopify-a11y | oxlint | Accessibility | a11y-no-hover-only-interaction | Interactive content appears only through `:hover` or mouse events without focus/click equivalent. |  |  |
| SHOP-071 | todo | shopify-a11y | oxlint | Accessibility | a11y-no-focus-context-shift | `onFocus` opens navigation, redirects, moves focus, or changes page context. |  |  |
| SHOP-072 | todo | shopify-a11y | agentlint | Accessibility | a11y-complex-gesture-has-simple-alternative | Multi-touch, drag, or 3D gesture component lacks simple tap/click fallback. |  |  |
| SHOP-073 | todo | shopify-a11y | oxlint | Accessibility | a11y-html-lang-required | Root HTML lacks `lang`. |  |  |
| SHOP-074 | todo | shopify-a11y | oxlint | Accessibility | a11y-viewport-zoom-enabled | Viewport meta disables zoom via `maximum-scale` or `user-scalable=no`. |  |  |
| SHOP-075 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-skip-link-main-target | Missing skip link, missing main element, or main lacks focus target. |  |  |
| SHOP-076 | todo | shopify-a11y | oxlint | Accessibility | a11y-no-positive-tabindex-or-autofocus | Positive `tabindex` or `autofocus` appears. |  |  |
| SHOP-077 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-heading-sequence | Page lacks `h1` or heading levels skip sequence. |  |  |
| SHOP-078 | todo | shopify-a11y | oxlint | Accessibility | a11y-nav-contract | Navigation lacks `nav`, `aria-current`, or uses menu roles for ordinary nav. |  |  |
| SHOP-079 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-dropdown-nav-contract | Dropdown nav lacks expanded/controls keyboard behavior or focus return. |  |  |
| SHOP-080 | todo | shopify-a11y | oxlint | Accessibility | a11y-product-image-alt | Product/content image lacks descriptive alt text. |  |  |
| SHOP-081 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-sale-price-screen-reader-text | Sale and regular price are only visually distinguished. |  |  |
| SHOP-082 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-dynamic-price-aria-live | Variant/quantity price or availability changes without `aria-live`. |  |  |
| SHOP-083 | todo | shopify-a11y | oxlint | Accessibility | a11y-semantic-link-button | Button is used for navigation or anchor is used for action. |  |  |
| SHOP-084 | todo | shopify-a11y | oxlint | Accessibility | a11y-new-window-warning | `target="_blank"` link lacks visible or screen-reader warning. |  |  |
| SHOP-085 | todo | shopify-a11y | oxlint | Accessibility | a11y-table-caption-and-scope | Data table lacks caption, header cells, or scope. |  |  |
| SHOP-086 | todo | shopify-a11y | oxlint | Accessibility | a11y-form-label-contract | Input lacks label, label lacks `for`, required field lacks `required`, or autocomplete is missing where useful. |  |  |
| SHOP-087 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-error-describedby-live | Field error lacks describedby, clear text, focus/announcement path, or live region. |  |  |
| SHOP-088 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-media-control-contract | Media ignores reduced motion, lacks controls, or cannot pause with keyboard. |  |  |
| SHOP-089 | todo | shopify-a11y | oxlint | Accessibility | a11y-decorative-image-empty-alt | Decorative image has non-empty alt or content image has missing alt. |  |  |
| SHOP-090 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-video-audio-accessibility | Video lacks captions/descriptive audio, autoplay video has sound, or audio lacks transcript/pause. |  |  |
| SHOP-091 | todo | shopify-a11y, shopify-bfs | e2e | Accessibility, BFS 4.1.1 | a11y-wcag-aa-contrast | Axe/contrast violation for text or UI. |  |  |
| SHOP-092 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-modal-dialog-contract | Modal/drawer lacks dialog semantics, initial focus, focus trap, Escape, or focus return. |  |  |
| SHOP-093 | todo | shopify-a11y | oxlint, e2e | Accessibility | a11y-slideshow-controls | Autoplay slideshow lacks pause/stop or slides lack navigation controls. |  |  |
| SHOP-094 | todo | shopify-a11y | e2e | Accessibility | a11y-touch-target-44 | Primary touch target is under 44x44 px. |  |  |
| SHOP-095 | todo | shopify-app-core | e2e | Mobile Support, BFS 4.1.2 | mobile-no-horizontal-scroll | Mobile viewport body scroll width exceeds client width. |  |  |
| SHOP-096 | todo | shopify-app-core | e2e, agentlint | Mobile Support | mobile-core-feature-availability | Mobile breakpoint hides core actions/features without unavailable notice. |  |  |
| SHOP-097 | todo | shopify-app-core | agentlint | Mobile Support | mobile-theme-setup-uses-app-extensions | Theme setup instructions require manual code changes instead of app extensions. |  |  |
| SHOP-098 | todo | shopify-app-core, shopify-bfs | e2e | BFS 4.1.2 | mobile-content-accessible | Mobile content is clipped/collapsed without accessible expand or reveal. |  |  |
| SHOP-099 | todo | shopify-app-core, shopify-bfs | e2e | BFS 4.1.2 | mobile-columns-stack | Two-column desktop layout remains two columns on mobile. |  |  |
| SHOP-100 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.1.1 | ui-uses-polaris-admin-look | Non-Polaris admin look: buttons, cards, fonts, body text size, or background diverge from admin. |  |  |
| SHOP-101 | todo | shopify-app-core, shopify-bfs | e2e | BFS 4.1.1 | tabs-do-not-change-content-above | Tab interaction mutates content above tab list. |  |  |
| SHOP-102 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.1.1 | list-icons-consistent | Repeated list/group mixes rows with icons and rows without icons. |  |  |
| SHOP-103 | todo | shopify-polaris-web-components, shopify-bfs | oxlint | BFS 4.1.4 | use-s-app-nav | Custom sidebar/nav or nav config exists without `<s-app-nav>`. |  |  |
| SHOP-104 | todo | shopify-polaris-web-components, shopify-bfs | oxlint | BFS 4.1.4 | no-nav-home-duplicate | `<s-app-nav>` has a home item duplicating app URL/name. |  |  |
| SHOP-105 | todo | shopify-polaris-web-components, shopify-bfs | oxlint | BFS 4.1.4 | no-nav-emoji | Navigation label string contains emoji. |  |  |
| SHOP-106 | todo | shopify-app-core, shopify-bfs | e2e | BFS 4.1.4 | nav-parent-selected-on-subroutes | Subroute does not mark parent navigation item selected. |  |  |
| SHOP-107 | todo | shopify-app-core, shopify-bfs | e2e | BFS 4.1.3 | nav-app-name-not-truncated | App name is truncated in Shopify admin navigation. |  |  |
| SHOP-108 | todo | shopify-polaris-web-components, shopify-bfs | oxlint | BFS 4.1.6 | s-modal-heading-required | `<s-modal>` is missing `heading`. |  |  |
| SHOP-109 | todo | shopify-polaris-web-components, shopify-bfs | oxlint | BFS 4.1.6 | s-modal-actions-use-slots | Modal buttons are not in primary/secondary action slots. |  |  |
| SHOP-110 | todo | shopify-polaris-web-components, shopify-polaris-react, shopify-bfs | oxlint | BFS 4.1.6 | no-polaris-fullscreen-bar | Deprecated FullscreenBar/fullscreen modal pattern is imported or used. |  |  |
| SHOP-111 | todo | shopify-app-core, shopify-bfs | agentlint, oxlint | BFS 4.1.5, App Home Settings | settings-form-save-bar | Form/settings page has dirty save workflow but lacks App Bridge Save Bar/CSB. |  |  |
| SHOP-112 | todo | shopify-app-core | agentlint | App Home Settings | settings-grouped-in-logical-sections | Settings route has many controls without logical sections/contextual help. |  |  |
| SHOP-113 | todo | shopify-app-core | oxlint, config | App Home Index | index-route-plural-resource-name | Resource index route/file uses singular or non-resource route name. |  |  |
| SHOP-114 | todo | shopify-app-core | oxlint, config | App Home Details | details-route-resource-id-shape | Resource detail route does not follow expected resource/id route shape. |  |  |
| SHOP-115 | todo | shopify-app-core, shopify-bfs | oxlint, agentlint | App Home Details, BFS 4.1.1 | details-page-back-action | Resource details/subpage lacks breadcrumb/back action. |  |  |
| SHOP-116 | todo | shopify-app-core, shopify-bfs | agentlint | App Home Homepage, BFS 4.2.3 | homepage-status-or-metrics | App home lacks setup, working status, or useful metrics where applicable. |  |  |
| SHOP-117 | todo | shopify-app-core, shopify-bfs | agentlint, config | BFS 4.2.3 | homepage-extension-status | Repo has app extensions but home route does not show extension status. |  |  |
| SHOP-118 | todo | shopify-app-core | oxlint, agentlint | App Home Footer Help | footer-help-descriptive-link | Footer/help link is missing or uses generic link text. |  |  |
| SHOP-119 | todo | shopify-app-core | agentlint | App Home Account Connection | account-connection-status-required | Account connection UI lacks status, account name, connect, or disconnect action. |  |  |
| SHOP-120 | todo | shopify-polaris-web-components | agentlint, oxlint | App Home Setup Guide | setup-guide-dismissible-and-trackable | Setup guide lacks dismiss control, progress state, or task completion tracking. |  |  |
| SHOP-121 | todo | shopify-polaris-web-components | agentlint, oxlint | App Home Empty State | empty-state-has-primary-action | Empty state lacks explanation plus primary action. |  |  |
| SHOP-122 | todo | shopify-polaris-web-components | agentlint, e2e | App Home Metrics Card | metrics-card-responsive-grid | Metrics cards lack responsive grid or trend/status indicators where comparison exists. |  |  |
| SHOP-123 | todo | shopify-app-core, shopify-bfs | oxlint, agentlint | BFS 4.2.1 | review-prominent-copy | Merchant-facing headings, nav labels, CTAs, empty states, or banners have spelling/grammar/context issues. |  |  |
| SHOP-124 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.2.2 | onboarding-is-actionable-and-removable | Onboarding lacks actionable steps or completion/dismiss behavior. |  |  |
| SHOP-125 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.2.2 | no-required-extra-app-onboarding | Onboarding frames another app install as mandatory. |  |  |
| SHOP-126 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.2.2 | merchant-info-asks-need-justification | Merchant information form lacks nearby explanation for why data is requested. |  |  |
| SHOP-127 | todo | shopify-app-core, shopify-bfs | oxlint, e2e | BFS 4.2.4 | error-contextual-not-toast | Form validation error appears only in toast or top banner instead of adjacent field. |  |  |
| SHOP-128 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 4.2.4 | no-pristine-field-errors | Field error is rendered before touched/submitted state. |  |  |
| SHOP-129 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.2.5 | button-group-dominant-logical-action | Related buttons have no dominant logical action or destructive/leave action is most prominent. |  |  |
| SHOP-130 | todo | shopify-app-core, shopify-bfs | e2e | BFS 4.2.6 | visual-editor-live-preview | Visual customization form changes do not update same-viewport preview. |  |  |
| SHOP-131 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.3.1 | no-outcome-guarantee-copy | Copy contains guaranteed, promised, or specific merchant outcome claims. |  |  |
| SHOP-132 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.3.2 | no-review-reward-or-guilt-copy | Copy offers review rewards or uses guilt/shame pressure wording. |  |  |
| SHOP-133 | todo | shopify-app-core, shopify-bfs | oxlint, agentlint | BFS 4.3.2 | no-upgrade-countdown-timer | Countdown timer appears near trial, billing, upgrade, or campaign copy. |  |  |
| SHOP-134 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 4.3.3 | no-auto-open-distracting-ui | Modal, popover, or banner auto-opens from effect/timer without merchant action. |  |  |
| SHOP-135 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 4.3.3 | no-attention-animation-without-action | Animation tries to draw attention to upgrade/banner/card without merchant action. |  |  |
| SHOP-136 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 4.3.3 | red-only-error-or-destructive | Red/critical token is used outside error or destructive action context. |  |  |
| SHOP-137 | todo | shopify-app-core, shopify-bfs | oxlint | BFS 4.3.4, App Home Homepage | single-visible-banner | Page or nearby container renders multiple visible banners. |  |  |
| SHOP-138 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.3.5 | no-shopify-impersonation | Assets/copy mimic Shopify, Sidekick, official/certified status, or Shopify-like branding. |  |  |
| SHOP-139 | todo | shopify-app-core, shopify-bfs | oxlint, agentlint | BFS 4.3.6 | banner-dismissible-when-promotional | Promotional/ad banner lacks dismissible UI and persisted dismissal state. |  |  |
| SHOP-140 | todo | shopify-app-core, shopify-bfs | agentlint | BFS 4.3.7 | premium-features-disabled-and-labeled | Gated controls lack disabled state, required tier label, or functional non-clickability. |  |  |
| SHOP-141 | todo | shopify-app-core, shopify-bfs | oxlint, agentlint | BFS 4.3.7 | plus-only-hidden-for-non-plus | Plus-only feature renders for non-Plus merchants without plan guard. |  |  |
| SHOP-142 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | card-title-required | `<Card>` with content/actions lacks title/header or nearby heading. |  |  |
| SHOP-143 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | card-header-actions-icon-tooltip | Card header icon action lacks tooltip or accessibility label. |  |  |
| SHOP-144 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | no-card-header-cta | Primary or secondary CTA button appears in card header. |  |  |
| SHOP-145 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React Card Layout | no-card-header-item-action | Card header action targets a list item or section instead of whole card. |  |  |
| SHOP-146 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React Card Layout, Common Actions | no-grouped-header-actions-by-default | Header action list/menu contains unrelated actions by default. |  |  |
| SHOP-147 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React Card Layout | no-section-actions-in-card-header | Section-specific action is placed in card header instead of section header. |  |  |
| SHOP-148 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | form-layout-for-form-items | Multiple form controls in Card without FormLayout/Stack grouping. |  |  |
| SHOP-149 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | no-card-section-per-list-item | Repeated list rows are wrapped as separate Card sections. |  |  |
| SHOP-150 | todo | shopify-polaris-react | agentlint | Polaris React Card Layout | long-card-needs-collapse-or-footer-action | Card has large repeated list without collapse, show more, or footer action. |  |  |
| SHOP-151 | todo | shopify-polaris-react | agentlint | Polaris React Card Layout | footer-cta-primary-only-for-page-critical | Card footer uses primary button where action is not page-critical. |  |  |
| SHOP-152 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | footer-action-list-for-many-ctas | Card footer has more than two CTAs without action list. |  |  |
| SHOP-153 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React Card Layout | no-footer-update-actions | Card footer CTA updates card content instead of progressing. |  |  |
| SHOP-154 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | use-stacks-not-padding-for-spacing | Invisible layout wrappers use padding classes/props where Stack gap should express spacing. |  |  |
| SHOP-155 | todo | shopify-polaris-react | oxlint | Polaris React Card Layout | card-gap-scale | Form items, sections, or section content use incorrect Polaris spacing scale. |  |  |
| SHOP-156 | todo | shopify-polaris-react | oxlint | Polaris React Common Actions | add-action-icon-convention | Add action lacks expected plus/circle-plus icon for its button variant. |  |  |
| SHOP-157 | todo | shopify-polaris-react | oxlint | Polaris React Common Actions | no-add-action-bottom-of-table | Add button appears after table/index table footer. |  |  |
| SHOP-158 | todo | shopify-polaris-react | agentlint | Polaris React Common Actions | no-intermediary-create-modal | Add/create action opens configuration modal before creation page. |  |  |
| SHOP-159 | todo | shopify-polaris-react | oxlint | Polaris React Common Actions | copy-action-icon-and-feedback | Copy action lacks clipboard icon or inline/toast feedback. |  |  |
| SHOP-160 | todo | shopify-polaris-react | oxlint | Polaris React Common Actions | delete-action-icon-and-placement | Delete uses wrong icon or is not placed inline/right/bottom as pattern expects. |  |  |
| SHOP-161 | todo | shopify-polaris-react | agentlint | Polaris React Common Actions | no-overused-critical-buttons | Many critical buttons appear in one view or compete with primary action. |  |  |
| SHOP-162 | todo | shopify-polaris-react | oxlint | Polaris React Common Actions | edit-action-icon-convention | Edit action lacks edit icon or expected tertiary icon style in dense actions. |  |  |
| SHOP-163 | todo | shopify-polaris-react | oxlint | Polaris React Common Actions | more-actions-icon-convention | More actions lacks menu-horizontal icon or expected icon-button style. |  |  |
| SHOP-164 | todo | shopify-polaris-react | oxlint | Polaris React Common Actions | pin-action-icon-convention | Pin action lacks pin icon or expected tertiary icon-button style. |  |  |
| SHOP-165 | todo | shopify-polaris-react | oxlint | Polaris React Date Picking | date-picker-has-text-input | DatePicker rendered without typed TextField activator/input. |  |  |
| SHOP-166 | todo | shopify-polaris-react | agentlint | Polaris React Date Picking | date-field-label-is-task-specific | Date label is vague instead of task-specific. |  |  |
| SHOP-167 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React New Features | new-badge-lifespan-required | New badge/pip lacks persisted seen/click/session expiry logic. |  |  |
| SHOP-168 | todo | shopify-polaris-react | oxlint | Polaris React Legacy New Badge | no-new-badge-primary-nav | New badge or pip appears in primary navigation. |  |  |
| SHOP-169 | todo | shopify-polaris-react | oxlint | Polaris React New Features | new-badge-info-tone-placement | New badge is not informational or not placed right of text/heading. |  |  |
| SHOP-170 | todo | shopify-polaris-react | oxlint | Polaris React Legacy Text Fields | text-field-no-placeholder-by-default | TextField uses placeholder outside allowed search/filter/email/minimalist cases. |  |  |
| SHOP-171 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React Legacy Text Fields | modeled-text-field-example-help-text | Date/tag/code/tracking-format field lacks help text with example. |  |  |
| SHOP-172 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React Legacy Text Fields | free-text-no-example-placeholder | Free-text title/name/description uses example placeholder instead of label/help text. |  |  |
| SHOP-173 | todo | shopify-polaris-react | oxlint, agentlint | Polaris React Legacy Text Fields | multiline-field-help-text-viewer | Notes/comments/customer-visible textarea lacks help text saying who can view it. |  |  |
| SHOP-174 | todo | shopify-polaris-react | oxlint | Polaris React Legacy Loading | loading-no-empty-spinner-view | Loading branch returns only Spinner or empty page. |  |  |
| SHOP-175 | todo | shopify-polaris-react | e2e | Polaris React Legacy Loading | loading-skeleton-matches-layout | Skeleton layout differs materially from final layout at breakpoints. |  |  |
| SHOP-176 | todo | shopify-polaris-react | e2e | Polaris React Legacy Loading | loading-feedback-within-100ms | Navigation/action lacks immediate pending feedback. |  |  |
| SHOP-177 | todo | shopify-polaris-react | oxlint | Polaris React Legacy Loading | no-spinner-as-placeholder | Spinner is used where skeleton/content placeholder would represent content. |  |  |
| SHOP-178 | todo | shopify-polaris-react | agentlint | Polaris React Legacy Pickers | no-picker-for-single-option | Picker receives exactly one static option. |  |  |
| SHOP-179 | todo | shopify-polaris-react | agentlint | Polaris React Legacy Pickers | small-picker-no-search-sort-filter | Picker with small option count has search/sort/filter. |  |  |
| SHOP-180 | todo | shopify-polaris-react | agentlint | Polaris React Legacy Pickers | large-picker-search-required | Picker over threshold lacks search. |  |  |
| SHOP-181 | todo | shopify-polaris-react | agentlint | Polaris React Legacy Pickers | location-picker-thresholds | Location picker does not follow one/two-to-ten/eleven-plus behavior thresholds. |  |  |
| SHOP-182 | todo | shopify-polaris-react | agentlint | Polaris React Legacy Pickers | segment-picker-thresholds | Segment picker does not pin/sort/search/page according to thresholds. |  |  |
| SHOP-183 | todo | shopify-app-core | config | Function Localization | functions-localized-name-description | Function TOML `name` or `description` is not a translation key. |  |  |
| SHOP-184 | todo | shopify-app-core | config | Function Localization | functions-locales-folder-required | Function extension uses localized TOML keys but lacks `locales/`. |  |  |
| SHOP-185 | todo | shopify-app-core | config | Function Localization | functions-default-locale-file-required | Function extension lacks default locale JSON file. |  |  |
| SHOP-186 | todo | shopify-app-core | config | Function Localization | functions-translation-keys-complete | TOML translation keys are missing from default or additional locale JSON. |  |  |
| SHOP-187 | todo | shopify-app-core | oxlint, agentlint | Function Localization | functions-output-messages-use-localization | Function output has customer-facing string literals but no localization input/lookup. |  |  |
| SHOP-188 | todo | shopify-app-core | oxlint, agentlint | Function Localization | functions-presentment-currency-rate-required | Function compares or emits merchant-configured fixed money without presentment currency rate. |  |  |
| SHOP-189 | todo | shopify-app-core | oxlint | Function Localization | functions-no-store-currency-comparison | Cart subtotal/discount threshold is compared directly to store-currency config. |  |  |
| SHOP-190 | todo | shopify-app-core | agentlint | Post-Purchase Product Offers UX | post-purchase-no-pressure-copy | Offer copy uses pressure, urgency, or order-status doubt. |  |  |
| SHOP-191 | todo | shopify-app-core | oxlint | Post-Purchase Product Offers UX | post-purchase-callout-banner-required | Product offer lacks top callout banner. |  |  |
| SHOP-192 | todo | shopify-app-core | e2e | Post-Purchase Product Offers UX | post-purchase-product-title-price-match-store | Offered title/price not sourced from current store product data. |  |  |
| SHOP-193 | todo | shopify-app-core | oxlint, e2e | Post-Purchase Product Offers UX | post-purchase-discount-price-display | Discounted offer lacks original struck price plus discounted price. |  |  |
| SHOP-194 | todo | shopify-app-core | oxlint | Post-Purchase Product Offers UX | post-purchase-image-component-required | Product offer lacks product Image component. |  |  |
| SHOP-195 | todo | shopify-app-core | e2e | Post-Purchase Product Offers UX | post-purchase-no-image-autoscroll | Product images auto-scroll or lack swipe/keyboard/thumbnail/prev-next navigation. |  |  |
| SHOP-196 | todo | shopify-app-core | oxlint, e2e | Post-Purchase Product Offers UX | post-purchase-price-breakdown-required | Offer lacks subtotal, shipping, taxes, or total summary. |  |  |
| SHOP-197 | todo | shopify-app-core | e2e | Post-Purchase Product Offers UX | post-purchase-price-breakdown-updates | Quantity/variant change does not update price breakdown. |  |  |
| SHOP-198 | todo | shopify-app-core | oxlint | Post-Purchase Product Offers UX | post-purchase-accept-button-copy-locked | Accept button text is merchant-configurable or differs from approved pay/add wording. |  |  |
| SHOP-199 | todo | shopify-app-core | oxlint, agentlint | Post-Purchase Product Offers UX | post-purchase-immediate-charge-disclosure | Immediate charge lacks summary modal or help text under button. |  |  |
| SHOP-200 | todo | shopify-app-core | oxlint | Post-Purchase Product Offers UX | post-purchase-accepted-confirmation-banner | Accepted upsell lacks confirmation banner. |  |  |
| SHOP-201 | todo | shopify-app-core | oxlint | Post-Purchase Product Offers UX | post-purchase-decline-copy-placement | Decline button text, placement, or prominence differs from expected pattern. |  |  |
| SHOP-202 | todo | shopify-app-core | oxlint, agentlint | Post-Purchase Product Offers UX | post-purchase-product-description-required | Offer lacks concise product description. |  |  |
| SHOP-203 | todo | shopify-app-core | agentlint, e2e | Post-Purchase Product Offers UX | post-purchase-long-description-split | Long description pushes pickers, price, or buttons below fold without summary split. |  |  |
| SHOP-204 | todo | shopify-app-core | oxlint | Post-Purchase Product Offers UX | post-purchase-variant-picker-contract | Multi-variant offer lacks Select, variant label, values, or size chart where relevant. |  |  |
| SHOP-205 | todo | shopify-app-core | oxlint | Post-Purchase Product Offers UX | post-purchase-quantity-stepper-contract | Quantity picker is not a number stepper with default one and label Quantity. |  |  |
| SHOP-206 | todo | shopify-app-core | oxlint, agentlint | Post-Purchase Product Offers UX | post-purchase-app-in-use-status | App does not query/show post-purchase activation status or guidance. |  |  |
| SHOP-207 | todo | shopify-app-core | monitor | Post-Purchase Product Offers UX | post-purchase-network-2s-budget | Post-purchase network call exceeds 2s budget. |  |  |
| SHOP-208 | todo | shopify-app-core | oxlint, agentlint | Post-Purchase Product Offers UX | post-purchase-should-render-network-only | Render needs network before UI instead of ShouldRender plus storage. |  |  |
| SHOP-209 | todo | shopify-app-core | oxlint | Post-Purchase Subscriptions UX | post-purchase-subscription-selling-plan-select | Subscription offer has multiple selling plans but no Select. |  |  |
| SHOP-210 | todo | shopify-app-core | oxlint | Post-Purchase Subscriptions UX | post-purchase-subscription-description-placement | Selling plan terms/summary not directly beneath selling plan options. |  |  |
| SHOP-211 | todo | shopify-app-core | oxlint | Post-Purchase Subscriptions UX | post-purchase-buyer-consent-required | Subscription post-purchase offer lacks BuyerConsent. |  |  |
| SHOP-212 | todo | shopify-app-core | oxlint | Post-Purchase Subscriptions UX | post-purchase-buyer-consent-placement | BuyerConsent is not between money summary and offer buttons. |  |  |
| SHOP-213 | todo | shopify-app-core | oxlint | Post-Purchase Subscriptions UX | post-purchase-buyer-consent-only-for-subscriptions | BuyerConsent appears on non-subscription offer. |  |  |
| SHOP-214 | todo | shopify-app-core | oxlint, e2e | Post-Purchase Subscriptions UX | post-purchase-recurring-summary-line | Subscription price breakdown lacks recurring summary line with selling plan and recurring cost. |  |  |
| SHOP-215 | todo | shopify-app-core | config, agentlint | Privacy Requirements | privacy-mandatory-webhooks-required | App handles personal data but lacks GDPR mandatory webhook handlers/config. |  |  |
| SHOP-216 | todo | shopify-app-core | agentlint | Privacy Requirements | privacy-policy-data-inventory | Scopes, tracking, or PII fields exist but privacy policy inventory is missing/stale. |  |  |
| SHOP-217 | todo | shopify-app-core | agentlint | Privacy Requirements | privacy-data-rights-process-required | PII storage exists but no access, correction, erasure request process is documented/routed. |  |  |
| SHOP-218 | todo | shopify-app-core | agentlint, e2e | Privacy Requirements | privacy-marketing-consent-optout | Marketing/ads segmentation uses personal data without consent or opt-out code path. |  |  |
| SHOP-219 | todo | shopify-bfs | monitor | BFS 2.1 | admin-web-vitals-budget | Embedded admin routes exceed LCP, CLS, or INP budget. |  |  |
| SHOP-220 | todo | shopify-bfs | e2e, monitor | BFS 2.2 | storefront-lighthouse-delta-budget | App install causes storefront Lighthouse/performance delta above budget. |  |  |
| SHOP-221 | todo | shopify-bfs | monitor | BFS 2.3, 5.4 | checkout-carrier-latency-budget | Checkout or carrier service latency/success violates configured SLO. |  |  |

## Tuning Queue

Start here unless we decide otherwise:

1. SHOP-001 `require-app-bridge-script`
2. SHOP-011 `no-asset-api-theme-writes`
3. SHOP-108 `s-modal-heading-required`
4. SHOP-109 `s-modal-actions-use-slots`
5. SHOP-103 `use-s-app-nav`
6. SHOP-170 `text-field-no-placeholder-by-default`
7. SHOP-018 `no-draft-order-custom-discounts`
8. SHOP-046 `optional-charge-off-by-default`
9. SHOP-183 `functions-localized-name-description`
10. SHOP-188 `functions-presentment-currency-rate-required`
11. SHOP-051 `checkout-require-network-timeout`
12. SHOP-054 `checkout-no-expensive-module-scope`
13. SHOP-061 `performance-no-parser-blocking-script`
14. SHOP-074 `a11y-viewport-zoom-enabled`
15. SHOP-076 `a11y-no-positive-tabindex-or-autofocus`
16. SHOP-198 `post-purchase-accept-button-copy-locked`

## Continuation Notes

Status as of 2026-06-30:

- `SHOP-001 require-app-bridge-script` is accepted as `done`.
- Continue with `SHOP-011 no-asset-api-theme-writes` unless priorities change.
- Current desired workflow: discuss one rule at a time, update the row status/decision/notes, and only implement rules after the trigger is accepted.
- For `SHOP-001`, support both static `index.html` and SSR document roots such as Remix, React Router framework, TanStack Router/Start, and similar root layout files.
- For `SHOP-001`, `@shopify/app-bridge-react` imports are applicability signals, not proof of compliance. The rule should pass only when the document head has the App Bridge script or a configured/known platform injector such as Gadget's `GADGET_CONFIG` placeholder.
- Raw fetched doc snapshots under `.tmp`, such as `shopify_bfs_requirements.html`, are scratch evidence and should not be committed unless we intentionally add a fixture.
