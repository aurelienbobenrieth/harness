import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  'Tokenized properties stay in CSS: set a CSS custom property with style.setProperty("--…", value) and let stylesheets consume it, instead of writing the property inline.';

type RuleOptions = { readonly properties?: readonly string[] };

const defaultTokenizedProperties = [
  "background",
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "boxShadow",
  "color",
  "columnGap",
  "fill",
  "fontSize",
  "gap",
  "lineHeight",
  "margin",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginTop",
  "outlineColor",
  "padding",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "rowGap",
  "stroke",
];

function tokenizedProperties(context: unknown): ReadonlySet<string> {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const properties = (first as RuleOptions).properties;
    if (Array.isArray(properties)) {
      return new Set(properties.filter((entry): entry is string => typeof entry === "string"));
    }
  }
  return new Set(defaultTokenizedProperties);
}

function stylePropertyName(expression: ESTree.Expression): string | undefined {
  if (expression.type !== "MemberExpression") return undefined;
  const object = expression.object;
  if (object.type !== "MemberExpression" || object.computed) return undefined;
  if (object.property.type !== "Identifier" || object.property.name !== "style") return undefined;

  if (!expression.computed && expression.property.type === "Identifier") return expression.property.name;
  if (expression.computed && expression.property.type === "Literal" && typeof expression.property.value === "string") {
    return expression.property.value;
  }
  return undefined;
}

export const noInlineStyleWrite: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow inline style writes for tokenized properties; set CSS custom properties instead.",
    },
    messages: {
      noInlineStyleWrite: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          properties: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      AssignmentExpression(node) {
        if (node.left.type !== "MemberExpression") return;
        const property = stylePropertyName(node.left);
        if (property === undefined || !tokenizedProperties(context).has(property)) return;
        context.report({ node, messageId: "noInlineStyleWrite" });
      },
    };
  },
};
