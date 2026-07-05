import stylelint, { type Rule } from "stylelint";
import { matchesAnyPattern, splitValueParts, stringArrayOption } from "../rule-support.js";

const ruleName = "shopify-theme/token-only";

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (property: string) =>
    `Expected "${property}" to use a design token var() so merchant color schemes and density settings keep working (rule.token-styling)`,
});

const defaultPrefixes = ["--theme-", "--scheme-"];

const defaultProperties = [
  "color",
  "background-color",
  "border-color",
  "border-*-color",
  "outline-color",
  "fill",
  "stroke",
  "box-shadow",
  "border-radius",
  "border-*-radius",
  "margin",
  "margin-*",
  "padding",
  "padding-*",
  "gap",
  "row-gap",
  "column-gap",
];

const passthroughValuePattern =
  /^(0|auto|none|inherit|initial|unset|revert|revert-layer|currentcolor|transparent|100%|max-content|min-content|fit-content)$/i;

type SecondaryOptions = {
  readonly prefixes?: readonly string[];
  readonly properties?: readonly string[];
};

function isTokenizedPart(part: string, prefixes: readonly string[]): boolean {
  if (passthroughValuePattern.test(part)) return true;
  if (part.startsWith("env(") || part.startsWith("inset")) return true;
  // functions deriving from a token (color-mix, calc, light-dark, …) count as tokenized
  return prefixes.some((prefix) => part.includes(`var(${prefix}`));
}

const rule: Rule = (primary, secondaryOptions) => (root, result) => {
  const validOptions = stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] });
  if (!validOptions) return;

  const options = (secondaryOptions ?? {}) as SecondaryOptions;
  const prefixes = stringArrayOption(options.prefixes) ?? defaultPrefixes;
  const properties = stringArrayOption(options.properties) ?? defaultProperties;

  root.walkDecls((declaration) => {
    if (!matchesAnyPattern(declaration.prop.toLowerCase(), properties)) return;
    if (declaration.prop.startsWith("--")) return;
    const parts = splitValueParts(declaration.value);
    if (parts.length === 0) return;
    if (parts.every((part) => isTokenizedPart(part, prefixes))) return;
    stylelint.utils.report({
      message: messages.rejected(declaration.prop),
      node: declaration,
      result,
      ruleName,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = { url: "https://github.com/aurelienbbn/harness" };

export const tokenOnly = stylelint.createPlugin(ruleName, rule);
export { ruleName as tokenOnlyRuleName };
