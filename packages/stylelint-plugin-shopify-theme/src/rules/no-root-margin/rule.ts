import stylelint, { type Rule } from "stylelint";

const ruleName = "shopify-theme/no-root-margin";

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (property: string) =>
    `Unexpected outer "${property}" on a component root: parents own spacing so blocks compose in any section (rule.placement)`,
});

const defaultRootSelectorPattern = "^\\.[a-z][\\w-]*$";
const marginPropertyPattern = /^margin(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/;
const zeroValuePattern = /^0(px|rem|em)?( +0(px|rem|em)?)*$/;

type SecondaryOptions = {
  readonly rootSelectorPattern?: string;
};

const rule: Rule = (primary, secondaryOptions) => (root, result) => {
  const validOptions = stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!validOptions) return;

  const options = (secondaryOptions ?? {}) as SecondaryOptions;
  const rootSelector = new RegExp(
    typeof options.rootSelectorPattern === "string" ? options.rootSelectorPattern : defaultRootSelectorPattern,
  );

  root.walkRules((styleRule) => {
    if (styleRule.parent?.type !== "root") return;
    if (!styleRule.selectors.every((selector) => rootSelector.test(selector.trim()))) return;

    styleRule.walkDecls((declaration) => {
      if (declaration.parent !== styleRule) return;
      if (!marginPropertyPattern.test(declaration.prop.toLowerCase())) return;
      if (zeroValuePattern.test(declaration.value.trim())) return;
      stylelint.utils.report({
        message: messages.rejected(declaration.prop),
        node: declaration,
        result,
        ruleName,
      });
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = { url: "https://github.com/aurelienbbn/harness" };

export const noRootMargin = stylelint.createPlugin(ruleName, rule);
export { ruleName as noRootMarginRuleName };
