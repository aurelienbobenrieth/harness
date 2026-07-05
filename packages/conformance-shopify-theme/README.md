# @aurelienbbn/conformance-shopify-theme

Structural conformance checks for Shopify themes: the requirements that live in file layout, Liquid layout contracts, and JSON schemas rather than in JavaScript. Ships as plain check functions plus a Vitest adapter.

## Checks

- `required-structure`: `layout/theme.liquid` must exist and `assets/` must stay flat (no subdirectories).
- `theme-liquid-contract`: `layout/theme.liquid` must output `{{ content_for_header }}` and `{{ content_for_layout }}`, set `lang` on `html`, include a viewport meta tag, and not block zoom.
- `locales-default`: exactly one `<lang>.default.json` in `locales/`, and every locale file must parse as JSON.
- `templates-valid`: JSON templates must parse, every section needs a `type`, and every `order` entry must exist in `sections`.
- `settings-schema`: `config/settings_schema.json` must parse as an array and declare `theme_info`.
- `no-parser-blocking-scripts`: external scripts in Liquid files must load with `defer`, `async`, or `type="module"` (theme performance requirement). Shopify's official Theme Check also covers this; keep whichever runs in your pipeline.
- `seo-contract`: `layout/theme.liquid` must render `canonical_url`, the theme must render a meta description; missing Open Graph/Twitter markup and missing product JSON-LD structured data are warnings. (Theme Check does not cover these.)

Findings carry a severity (`error`/`warning`) and the shopify.dev URL that justifies them.

## Vitest usage

```ts
// conformance.test.ts
import { shopifyThemeConformance } from "@aurelienbbn/conformance-shopify-theme/vitest";

shopifyThemeConformance({ root: process.cwd() });
```

## Programmatic usage

```ts
import { runShopifyThemeConformance } from "@aurelienbbn/conformance-shopify-theme";

const findings = await runShopifyThemeConformance({ root: process.cwd() });
```
