import { defineConfig } from "@aurelienbbn/agentlint";
import { preferSchemaContracts } from "./rules/prefer-schema-contracts/rule.js";

export { preferSchemaContracts } from "./rules/prefer-schema-contracts/rule.js";

export const strictPreset = defineConfig({
  rules: {
    "effect/prefer-schema-contracts": preferSchemaContracts,
  },
  include: ["**/*.{ts,tsx}"],
  ignore: ["**/*.d.ts"],
});
