import stylelint, { type Rule } from "stylelint";
import { stringArrayOption } from "../rule-support.js";

const ruleName = "shopify-theme/breakpoint-tokens";

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (params: string) =>
    `Unexpected media query "${params}": only the shared breakpoint set keeps layouts aligned across blocks (rule.breakpoints)`,
});

type SecondaryOptions = {
  readonly allowed?: readonly string[];
};

function normalizeParams(params: string): string {
  return params
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\s*:\s*/g, ": ")
    .trim();
}

const rule: Rule = (primary, secondaryOptions) => (root, result) => {
  const validOptions = stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!validOptions) return;

  const allowed = stringArrayOption((secondaryOptions as SecondaryOptions | undefined)?.allowed);
  if (allowed === undefined || allowed.length === 0) return;
  const normalizedAllowed = new Set(allowed.map(normalizeParams));

  root.walkAtRules(/^media$/i, (atRule) => {
    if (normalizedAllowed.has(normalizeParams(atRule.params))) return;
    stylelint.utils.report({
      message: messages.rejected(atRule.params),
      node: atRule,
      result,
      ruleName,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = { url: "https://github.com/aurelienbbn/harness" };

export const breakpointTokens = stylelint.createPlugin(ruleName, rule);
export { ruleName as breakpointTokensRuleName };
