import { defineConfig } from "@aurelienbbn/agentlint";
import { queryStateCoverage } from "./rules/query-state-coverage/rule.js";

export { queryStateCoverage } from "./rules/query-state-coverage/rule.js";

export const strictPreset = defineConfig({
  rules: {
    "tanstack-query/query-state-coverage": queryStateCoverage,
  },
  include: ["**/*.{ts,tsx}"],
  ignore: ["**/*.d.ts"],
});
