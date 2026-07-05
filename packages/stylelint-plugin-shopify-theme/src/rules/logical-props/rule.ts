import stylelint, { type Rule } from "stylelint";

const ruleName = "shopify-theme/logical-props";

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejectedProperty: (property: string, replacement: string) =>
    `Unexpected physical property "${property}": use "${replacement}" so RTL locales mirror correctly (rule.rtl)`,
  rejectedValue: (property: string, value: string) =>
    `Unexpected physical value "${value}" for "${property}": use logical start/end keywords (rule.rtl)`,
});

const physicalPropertyReplacements = new Map([
  ["margin-left", "margin-inline-start"],
  ["margin-right", "margin-inline-end"],
  ["padding-left", "padding-inline-start"],
  ["padding-right", "padding-inline-end"],
  ["border-left", "border-inline-start"],
  ["border-left-width", "border-inline-start-width"],
  ["border-left-style", "border-inline-start-style"],
  ["border-left-color", "border-inline-start-color"],
  ["border-right", "border-inline-end"],
  ["border-right-width", "border-inline-end-width"],
  ["border-right-style", "border-inline-end-style"],
  ["border-right-color", "border-inline-end-color"],
  ["border-top-left-radius", "border-start-start-radius"],
  ["border-top-right-radius", "border-start-end-radius"],
  ["border-bottom-left-radius", "border-end-start-radius"],
  ["border-bottom-right-radius", "border-end-end-radius"],
  ["left", "inset-inline-start"],
  ["right", "inset-inline-end"],
]);

const directionalValueProperties = new Map([
  [
    "text-align",
    new Map([
      ["left", "start"],
      ["right", "end"],
    ]),
  ],
  [
    "float",
    new Map([
      ["left", "inline-start"],
      ["right", "inline-end"],
    ]),
  ],
  [
    "clear",
    new Map([
      ["left", "inline-start"],
      ["right", "inline-end"],
    ]),
  ],
]);

const rule: Rule = (primary) => (root, result) => {
  const validOptions = stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!validOptions) return;

  root.walkDecls((declaration) => {
    const property = declaration.prop.toLowerCase();

    const replacement = physicalPropertyReplacements.get(property);
    if (replacement !== undefined) {
      stylelint.utils.report({
        message: messages.rejectedProperty(declaration.prop, replacement),
        node: declaration,
        result,
        ruleName,
      });
      return;
    }

    const valueMap = directionalValueProperties.get(property);
    if (valueMap === undefined) return;
    const value = declaration.value.trim().toLowerCase();
    if (!valueMap.has(value)) return;
    stylelint.utils.report({
      message: messages.rejectedValue(declaration.prop, declaration.value),
      node: declaration,
      result,
      ruleName,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = { url: "https://github.com/aurelienbbn/harness" };

export const logicalProps = stylelint.createPlugin(ruleName, rule);
export { ruleName as logicalPropsRuleName };
