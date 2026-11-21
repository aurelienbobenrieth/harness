---
"@aurelienbbn/conformance-shopify-app": minor
---

`checkout-bundle-size` measures the compressed size Shopify limits at deploy: each `.js` under `dist/` is brotli-compressed at quality 11, as Shopify CLI estimates its build output, and the sum is compared with 64 KB (128 KB for full-page customer account extensions). A bundle over 64 KB raw that compresses below the limit no longer fails; `checkoutBundleLimitKb` is now a compressed budget.
