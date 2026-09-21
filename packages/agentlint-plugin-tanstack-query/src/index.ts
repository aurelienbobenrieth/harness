import { defineConfig } from "@aurelienbbn/agentlint";
import { imperativeQueryFetching } from "./rules/imperative-query-fetching/rule.js";
import { mutationStateCoverage } from "./rules/mutation-state-coverage/rule.js";
import { queryStateCoverage } from "./rules/query-state-coverage/rule.js";

export { imperativeQueryFetching } from "./rules/imperative-query-fetching/rule.js";
export { mutationStateCoverage } from "./rules/mutation-state-coverage/rule.js";
export { queryFreshnessIntent } from "./rules/query-freshness-intent/rule.js";
export { queryStateCoverage } from "./rules/query-state-coverage/rule.js";

/** Every confident rule. `queryFreshnessIntent` is opinionated and stays opt-in: add it to `rules` explicitly. */
export const strictPreset = defineConfig({
  rules: [queryStateCoverage, mutationStateCoverage, imperativeQueryFetching],

  ignores: ["**/*.d.ts"],
});

/** Small, explicitly selected starting point. Calibrate its scope before enforcing it.
 * @attribution desloppify by Peter O'Malley (workflow inspiration only; independently implemented)
 */
export const starterPreset = defineConfig({ rules: [queryStateCoverage], ignores: ["**/*.d.ts"] });
