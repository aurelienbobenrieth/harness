import { defineConfig } from "@aurelienbbn/agentlint";
import { cartMutationFeedback } from "./rules/cart-mutation-feedback/rule.js";
import { registryDrift } from "./rules/registry-drift/rule.js";
import { respectReducedMotion } from "./rules/respect-reduced-motion/rule.js";
import { schemaUx } from "./rules/schema-ux/rule.js";
import { translatedUiStrings } from "./rules/translated-ui-strings/rule.js";
import { webComponentLifecycle } from "./rules/web-component-lifecycle/rule.js";

export {
  cartMutationFeedback,
  defineCartMutationFeedback,
  type CartMutationFeedbackOptions,
} from "./rules/cart-mutation-feedback/rule.js";
export { defineRegistryDrift, registryDrift, type RegistryDriftOptions } from "./rules/registry-drift/rule.js";
export {
  defineRespectReducedMotion,
  respectReducedMotion,
  type RespectReducedMotionOptions,
} from "./rules/respect-reduced-motion/rule.js";
export { defineSchemaUx, schemaUx, type SchemaUxOptions } from "./rules/schema-ux/rule.js";
export {
  defineTranslatedUiStrings,
  translatedUiStrings,
  type TranslatedUiStringsOptions,
} from "./rules/translated-ui-strings/rule.js";
export {
  defineWebComponentLifecycle,
  webComponentLifecycle,
  type WebComponentLifecycleOptions,
} from "./rules/web-component-lifecycle/rule.js";

export const shopifyThemePreset = defineConfig({
  rules: {
    "shopify-theme/cart-mutation-feedback": cartMutationFeedback,
    "shopify-theme/registry-drift": registryDrift,
    "shopify-theme/respect-reduced-motion": respectReducedMotion,
    "shopify-theme/schema-ux": schemaUx,
    "shopify-theme/translated-ui-strings": translatedUiStrings,
    "shopify-theme/web-component-lifecycle": webComponentLifecycle,
  },
  files: ["assets/**/*.js", "frontend/**/*.{js,ts}", "config/settings_schema.json"],
  ignores: ["**/*.min.js"],
});
