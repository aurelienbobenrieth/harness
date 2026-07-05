# @aurelienbbn/oxlint-plugin-shopify-theme

Custom oxlint rules for Shopify theme JavaScript (files under `assets/`).

## Rules

- `shopify-theme/no-external-dependencies`: disallow external package imports in theme JavaScript. Themes should use native browser APIs; the minified theme JS budget is 16 KB. Relative paths and the `@theme/*` import-map alias are allowed. Deliberate framework choices go through the `allow` option so every exception is visible in config:

  ```jsonc
  {
    "rules": {
      "shopify-theme/no-external-dependencies": ["error", { "allow": ["lit", "@lit", "xstate"] }],
    },
  }
  ```

- `shopify-theme/require-module-or-iife`: classic (non-module) scripts must not declare top-level variables, functions, or classes outside an IIFE, because theme scripts share the global scope. Deliberate global bridges stay allowed: explicit `window.theme = ...` assignments and top-level `customElements.define(...)` calls are expression statements, not declarations, so the rule never flags them — the point is to make every global _intentional and greppable_ instead of an accidental leak.

## Autofix

Neither rule is autofixable: removing a dependency requires choosing the native replacement, and scoping a script requires deciding between module conversion and an IIFE wrapper.
