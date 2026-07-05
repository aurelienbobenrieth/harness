/**
 * Recommended stylelint config: enables every rule with its defaults.
 *
 * Usage: { "extends": ["@aurelienbbn/stylelint-plugin-shopify-theme/recommended"] }
 * Override rule options (breakpoint set, token prefixes, z scale) per project.
 */
export default {
  plugins: ["@aurelienbbn/stylelint-plugin-shopify-theme"],
  rules: {
    "shopify-theme/token-only": true,
    "shopify-theme/no-root-margin": true,
    "shopify-theme/logical-props": true,
    "shopify-theme/z-scale": true,
    "shopify-theme/breakpoint-tokens": true,
  },
};
