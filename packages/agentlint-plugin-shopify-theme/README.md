# @aurelienbbn/agentlint-plugin-shopify-theme

Custom agentlint rules for Shopify theme JavaScript, distilled from Shopify theme best practices and the Horizon reference theme standards.

## Rules

- `shopify-theme/web-component-lifecycle`: custom element registrations — verify listeners, observers, timers, and in-flight requests are cleaned up in `disconnectedCallback` (sections re-render in the theme editor).
- `shopify-theme/cart-mutation-feedback`: AJAX cart mutations (`/cart/add.js`, `/cart/change.js`, ...) — verify pending state, error recovery, aria-live announcement, and a bubbling cart-updated event.
- `shopify-theme/respect-reduced-motion`: JS-driven animation or smooth scrolling — verify a `prefers-reduced-motion` fallback.
- `shopify-theme/translated-ui-strings`: DOM text assigned from string literals — verify buyer-facing copy comes from locale files.

## Configuration

Every rule exports a `defineX(options)` factory next to its default instance. Options: `cart-mutation-feedback` (`endpointPattern`, `networkCallPattern`), `respect-reduced-motion` (`motionCallPattern`, `motionGuardPattern` — point it at your shared motion helper), `translated-ui-strings` (`textProperties`, `minLetters`; letter matching is Unicode-aware, so non-English copy triggers too), `web-component-lifecycle` (`defineCallPattern`, `defineDecoratorPattern` — Lit's `@customElement` decorator is covered by default).

## Preset

- `shopifyThemePreset`: all four rules over `assets/**/*.js` and `frontend/**/*.{js,ts}`.

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { shopifyThemePreset } from "@aurelienbbn/agentlint-plugin-shopify-theme";

export default defineConfig({
  extends: [shopifyThemePreset],
});
```
