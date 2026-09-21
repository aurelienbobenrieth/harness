import { defineConfig } from "@aurelienbbn/agentlint";
import { preferSchemaContracts } from "./rules/prefer-schema-contracts/rule.js";

export { layerIdentity } from "./rules/layer-identity/rule.js";
export { preferSchemaContracts } from "./rules/prefer-schema-contracts/rule.js";
export {
  defineResiliencePolicy,
  resiliencePolicy,
  type ResiliencePolicyOptions,
} from "./rules/resilience-policy/rule.js";

export const strictPreset = defineConfig({
  rules: [preferSchemaContracts],

  ignores: ["**/*.d.ts"],
});

/** Small, explicitly selected starting point. Calibrate its scope before enforcing it.
 * @attribution desloppify by Peter O'Malley (workflow inspiration only; independently implemented)
 */
export const starterPreset = defineConfig({
  rules: [preferSchemaContracts],
  ignores: ["**/*.d.ts"],
});
