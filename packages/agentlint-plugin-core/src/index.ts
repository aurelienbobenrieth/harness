import { defineConfig } from "@aurelienbbn/agentlint";
import { boundedDataAccess } from "./rules/bounded-data-access/rule.js";

export { boundedDataAccess } from "./rules/bounded-data-access/rule.js";

export const strictPreset = defineConfig({
  rules: {
    "core/bounded-data-access": boundedDataAccess,
  },
  include: ["**/*.{ts,tsx}"],
  ignore: ["**/*.d.ts"],
});
