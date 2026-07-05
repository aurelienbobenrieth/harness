# @aurelienbbn/stylelint-plugin-shopify-theme

Custom stylelint rules for Shopify theme CSS: design-token discipline, composable spacing, RTL-safe logical properties, and a shared overlay/breakpoint scale.

## Rules

- `shopify-theme/token-only`: color/spacing/radius/shadow values must come from design token `var()`s (`prefixes`, `properties` configurable) so merchant color schemes and density settings keep working.
- `shopify-theme/no-root-margin`: no outer margins on component root selectors; parents own spacing so blocks compose in any section (`rootSelectorPattern` configurable).
- `shopify-theme/logical-props`: physical `*-left`/`*-right` properties and `left`/`right` values are rejected in favour of logical equivalents for RTL support.
- `shopify-theme/z-scale`: `z-index` only via overlay scale tokens (`pattern` configurable); `auto`, `0`, `-1` stay allowed for local stacking.
- `shopify-theme/breakpoint-tokens`: `@media` params must match the configured `allowed` breakpoint set; silent until configured.

## Usage

```json
{
  "extends": ["@aurelienbbn/stylelint-plugin-shopify-theme/recommended"],
  "rules": {
    "shopify-theme/breakpoint-tokens": [true, { "allowed": ["(min-width: 750px)", "(min-width: 990px)"] }]
  }
}
```
