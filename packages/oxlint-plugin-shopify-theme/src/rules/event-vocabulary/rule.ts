import type { ESTree, Rule } from "@oxlint/plugins";

const customEventMessage =
  "Custom event names come from the storefront-events vocabulary: use an exported constant, or a namespaced literal building on Shopify standard events.";
const listenerMessage =
  "Namespaced event listeners must match the storefront-events vocabulary prefixes so contracts stay machine-readable.";

type RuleOptions = { readonly allowedPrefixes?: readonly string[] };

const defaultAllowedPrefixes = ["oio:", "shopify:"];
const listenerMethods = new Set(["addEventListener", "removeEventListener"]);

function allowedPrefixes(context: unknown): readonly string[] {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const prefixes = (first as RuleOptions).allowedPrefixes;
    if (Array.isArray(prefixes)) {
      return prefixes.filter((entry): entry is string => typeof entry === "string");
    }
  }
  return defaultAllowedPrefixes;
}

function literalEventName(argument: ESTree.Expression | ESTree.SpreadElement | undefined): string | undefined {
  if (argument === undefined || argument.type !== "Literal") return undefined;
  return typeof argument.value === "string" ? argument.value : undefined;
}

function hasAllowedPrefix(name: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => name.startsWith(prefix));
}

export const eventVocabulary: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require dispatched and listened event names to follow the storefront-events vocabulary.",
    },
    messages: {
      customEventName: customEventMessage,
      listenerEventName: listenerMessage,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedPrefixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        const callee = node.callee;
        if (callee.type !== "Identifier" || callee.name !== "CustomEvent") return;
        const name = literalEventName(node.arguments[0]);
        if (name === undefined) return;
        if (hasAllowedPrefix(name, allowedPrefixes(context))) return;
        context.report({ node: node.arguments[0] ?? node, messageId: "customEventName" });
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier" || !listenerMethods.has(callee.property.name)) return;
        const name = literalEventName(node.arguments[0]);
        if (name === undefined || !name.includes(":")) return;
        if (hasAllowedPrefix(name, allowedPrefixes(context))) return;
        context.report({ node: node.arguments[0] ?? node, messageId: "listenerEventName" });
      },
    };
  },
};
