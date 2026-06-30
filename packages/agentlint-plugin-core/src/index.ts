import { defineConfig } from "@aurelienbbn/agentlint";
import { boundedDataAccess } from "./rules/bounded-data-access/rule.js";
import { boundedWork } from "./rules/bounded-work/rule.js";

export { boundedDataAccess } from "./rules/bounded-data-access/rule.js";
export { boundedWork } from "./rules/bounded-work/rule.js";

export const strictPreset = defineConfig({
  rules: {
    "core/bounded-data-access": boundedDataAccess,
    "core/bounded-work": boundedWork,
  },
  files: ["**/*.{ts,tsx}"],
  ignores: ["**/*.d.ts"],
});
