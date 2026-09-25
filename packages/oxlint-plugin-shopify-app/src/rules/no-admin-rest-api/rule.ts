import type { Context, ESTree, Rule, Scope } from "@oxlint/plugins";
import { staticValue } from "../jsx-support.js";

function unshadowed(context: Context, identifier: Extract<ESTree.Node, { type: "Identifier" }>): boolean {
  let scope: Scope | null = context.sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined && variable.defs.length > 0) return false;
    scope = scope.upper;
  }
  return true;
}

function globalCall(context: Context, callee: ESTree.Node, name: string): boolean {
  if (callee.type === "Identifier") return callee.name === name && unshadowed(context, callee);
  if (callee.type !== "MemberExpression" || callee.object.type !== "Identifier") return false;
  const property = callee.computed ? staticValue(callee.property) : undefined;
  return (
    ["window", "globalThis", "self"].includes(callee.object.name) &&
    unshadowed(context, callee.object) &&
    (callee.computed
      ? property?.kind === "known" && property.value === name
      : callee.property.type === "Identifier" && callee.property.name === name)
  );
}

function restResourceModule(value: unknown): boolean {
  return typeof value === "string" && /^@shopify\/shopify-api\/rest\/admin(?:\/|$)/.test(value);
}

function restEndpoint(node: ESTree.Node): boolean {
  const value = staticValue(node);
  const text =
    value.kind === "known" && typeof value.value === "string"
      ? value.value
      : node.type === "TemplateLiteral"
        ? node.quasis.map((quasi) => quasi.value.cooked ?? "").join("harness-dynamic")
        : undefined;
  if (text === undefined) return false;
  const path = text.startsWith("/admin/api/")
    ? text
    : (() => {
        try {
          const url = new URL(text);
          return /^https?:$/.test(url.protocol) && /(?:^|\.)myshopify\.com$/i.test(url.hostname) ? url.pathname : "";
        } catch {
          return "";
        }
      })();
  const match = /^\/admin\/api\/(?:\d{4}-\d{2}|unstable)\/([^/?#.]+)(?:\/[^?#]+)?\.json(?:[?#]|$)/.exec(path);
  return match !== null && match[1] !== "graphql" && !match[1]?.includes("harness-dynamic");
}

/** @attribution https://shopify.dev/docs/api/admin-rest (inspiration; independently implemented) */
export const noAdminRestApi: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Shopify REST Admin resource imports and unshadowed fetch calls to recognizable REST Admin endpoints; enable for new public apps.",
    },
    messages: {
      rest: "New public Shopify apps must use GraphQL Admin APIs: replace this REST Admin dependency or request (Shopify REST Admin migration policy).",
    },
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type" || !restResourceModule(node.source.value)) return;
        if (
          node.specifiers.length > 0 &&
          node.specifiers.every((specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type")
        )
          return;
        context.report({ node, messageId: "rest" });
      },
      ImportExpression(node) {
        const source = staticValue(node.source);
        if (source.kind === "known" && restResourceModule(source.value)) context.report({ node, messageId: "rest" });
      },
      CallExpression(node) {
        const input = node.arguments[0];
        if (input === undefined || input.type === "SpreadElement") return;
        if (globalCall(context, node.callee, "fetch") && restEndpoint(input))
          context.report({ node, messageId: "rest" });
        const value = staticValue(input);
        if (globalCall(context, node.callee, "require") && value.kind === "known" && restResourceModule(value.value))
          context.report({ node, messageId: "rest" });
      },
    };
  },
};
