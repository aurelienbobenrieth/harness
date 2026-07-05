import { eslintCompatPlugin } from "@oxlint/plugins";
import { customElementPrefix } from "./rules/custom-element-prefix/rule.js";
import { eventVocabulary } from "./rules/event-vocabulary/rule.js";
import { featureBoundaries } from "./rules/feature-boundaries/rule.js";
import { lazyHydration } from "./rules/lazy-hydration/rule.js";
import { noDirectCartFetch } from "./rules/no-direct-cart-fetch/rule.js";
import { noExternalDependencies } from "./rules/no-external-dependencies/rule.js";
import { noInlineStyleWrite } from "./rules/no-inline-style-write/rule.js";
import { requireModuleOrIife } from "./rules/require-module-or-iife/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "shopify-theme",
  },
  rules: {
    "custom-element-prefix": customElementPrefix,
    "event-vocabulary": eventVocabulary,
    "feature-boundaries": featureBoundaries,
    "lazy-hydration": lazyHydration,
    "no-direct-cart-fetch": noDirectCartFetch,
    "no-external-dependencies": noExternalDependencies,
    "no-inline-style-write": noInlineStyleWrite,
    "require-module-or-iife": requireModuleOrIife,
  },
});
