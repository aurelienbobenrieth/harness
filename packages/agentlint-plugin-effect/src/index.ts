import { defineConfig } from "@aurelienbbn/agentlint";
import { conversionKeepsFailure } from "./rules/conversion-keeps-failure/rule.js";
import { refusalReasonReachesReader } from "./rules/refusal-reason-reaches-reader/rule.js";
import { transactionNoNetwork } from "./rules/transaction-no-network/rule.js";

export { conversionKeepsFailure } from "./rules/conversion-keeps-failure/rule.js";
export { refusalReasonReachesReader } from "./rules/refusal-reason-reaches-reader/rule.js";
export {
  defineTransactionNoNetwork,
  transactionNoNetwork,
  type TransactionNoNetworkOptions,
} from "./rules/transaction-no-network/rule.js";

export const strictPreset = defineConfig({
  rules: [transactionNoNetwork, conversionKeepsFailure, refusalReasonReachesReader],
  ignores: ["**/*.d.ts"],
});

/** Small, explicitly selected starting point. Calibrate its scope before enforcing it.
 * @attribution desloppify by Peter O'Malley (workflow inspiration only; independently implemented)
 */
export const starterPreset = defineConfig({
  rules: [transactionNoNetwork, conversionKeepsFailure, refusalReasonReachesReader],
  ignores: ["**/*.d.ts"],
});
