import stylelint, { type Rule } from "stylelint";

const ruleName = "shopify-theme/z-scale";

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (value: string) =>
    `Unexpected z-index "${value}": stacking contexts come from the overlay scale tokens so surfaces layer predictably (rule.z-scale)`,
});

const defaultPattern = "^var\\(--theme-z-[\\w-]+\\)$";

type SecondaryOptions = {
  readonly pattern?: string;
};

const rule: Rule = (primary, secondaryOptions) => (root, result) => {
  const validOptions = stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!validOptions) return;

  const options = (secondaryOptions ?? {}) as SecondaryOptions;
  const allowedPattern = new RegExp(typeof options.pattern === "string" ? options.pattern : defaultPattern);

  root.walkDecls(/^z-index$/i, (declaration) => {
    const value = declaration.value.trim();
    if (value === "auto" || value === "0" || value === "-1") return;
    if (allowedPattern.test(value)) return;
    stylelint.utils.report({
      message: messages.rejected(declaration.value),
      node: declaration,
      result,
      ruleName,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = { url: "https://github.com/aurelienbbn/harness" };

export const zScale = stylelint.createPlugin(ruleName, rule);
export { ruleName as zScaleRuleName };
