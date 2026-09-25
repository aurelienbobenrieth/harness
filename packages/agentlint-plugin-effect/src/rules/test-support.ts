import type { StateRule, Visitors } from "@aurelienbbn/agentlint";
import type { RuleContext } from "@aurelienbbn/agentlint";

export function createVisitors(rule: StateRule, context: RuleContext): Visitors {
  const create = rule.detector.createOnce;
  if (!create) throw new Error("Expected an imperative state detector");
  return create({ context, options: rule.binding.options });
}
