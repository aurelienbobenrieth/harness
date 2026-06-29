import { defineConfig } from "@aurelienbbn/agentlint";
import { boundedDataAccess } from "./rules/bounded-data-access/rule.js";
import { boundedWorkReview } from "./rules/bounded-work-review/rule.js";

export { boundedDataAccess } from "./rules/bounded-data-access/rule.js";
export { boundedWorkReview } from "./rules/bounded-work-review/rule.js";

export const strictPreset = defineConfig({
  rules: {
    "core/bounded-data-access": boundedDataAccess,
    "core/bounded-work-review": boundedWorkReview,
  },
  include: ["**/*.{ts,tsx}"],
  ignore: ["**/*.d.ts"],
});
