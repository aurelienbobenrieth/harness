import { defineConfig } from "@aurelienbbn/agentlint";
import { adoptReview } from "./rules/adopt-review/rule.js";
import { removalPolicyChange } from "./rules/removal-policy-change/rule.js";
import { removalPolicyReview } from "./rules/removal-policy-review/rule.js";
import { resourceReplacementReview } from "./rules/resource-replacement-review/rule.js";
import { stateStoreChange } from "./rules/state-store-change/rule.js";

export { adoptReview } from "./rules/adopt-review/rule.js";
export {
  defineInitConfigExposure,
  initConfigExposure,
  type InitConfigExposureOptions,
} from "./rules/init-config-exposure/rule.js";
export {
  defineRemovalPolicyChange,
  removalPolicyChange,
  type RemovalPolicyChangeOptions,
} from "./rules/removal-policy-change/rule.js";
export {
  defineRemovalPolicyReview,
  removalPolicyReview,
  type RemovalPolicyReviewOptions,
} from "./rules/removal-policy-review/rule.js";
export {
  defineResourceReplacementReview,
  resourceReplacementReview,
  type ReplacementProp,
  type ReplacementTrigger,
  type ResourceReplacementReviewOptions,
} from "./rules/resource-replacement-review/rule.js";
export { stateStoreChange } from "./rules/state-store-change/rule.js";

/**
 * Every settled Alchemy rule. `initConfigExposure` is exported but stays out until calibrated against a consumer.
 */
export const strictPreset = defineConfig({
  rules: [resourceReplacementReview, removalPolicyReview, removalPolicyChange, stateStoreChange, adoptReview],
  ignores: ["**/*.d.ts"],
});

/** Small, explicitly selected starting point: the two change gates that stop silent data loss. Calibrate before enforcing.
 * @attribution desloppify by Peter O'Malley (workflow inspiration only; independently implemented)
 */
export const starterPreset = defineConfig({
  rules: [resourceReplacementReview, stateStoreChange],
  ignores: ["**/*.d.ts"],
});
