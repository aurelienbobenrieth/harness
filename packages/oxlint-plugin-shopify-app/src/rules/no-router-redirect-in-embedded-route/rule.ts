import type { ESTree, Rule } from "@oxlint/plugins";
import { isAuthenticateCall, resolveVariable } from "../ast-support.js";

const routerModules = new Set([
  "react-router",
  "@remix-run/node",
  "@remix-run/server-runtime",
  "@remix-run/cloudflare",
]);
const adminOnly = new Set(["admin"]);
const leavesIframe = /^(?:https:\/\/|shopify:\/\/)/i;

function staticPrefix(node: ESTree.Node | undefined): string {
  if (node?.type === "Literal") return typeof node.value === "string" ? node.value : "";
  if (node?.type === "TemplateLiteral") return node.quasis[0]?.value.cooked ?? "";
  return "";
}

/**
 * @attribution https://github.com/Shopify/shopify-app-template-react-router (inspiration; independently implemented)
 */
export const noRouterRedirectInEmbeddedRoute: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer the redirect helper returned by authenticate.admin over the router's redirect in modules that authenticate admin requests, and always for https:// or shopify:// destinations.",
    },
    messages: {
      preferEmbeddedRedirect:
        "This embedded route redirects with the router's `redirect`, which drops the embedded-app parameters. Use the `redirect` returned by `authenticate.admin(request)`.",
      externalRedirect:
        "The router's `redirect` cannot leave the Shopify admin iframe for `{{destination}}`. Use the `redirect` returned by `authenticate.admin(request)` with a `target` of `_top` or `_parent`.",
    },
  },
  createOnce(context) {
    let authenticatesAdmin = false;
    let calls: ESTree.CallExpression[] = [];

    return {
      before() {
        authenticatesAdmin = false;
        calls = [];
      },
      CallExpression(node) {
        if (isAuthenticateCall(node, adminOnly)) {
          authenticatesAdmin = true;
          return;
        }
        if (node.callee.type !== "Identifier") return;
        const definition = resolveVariable(context, node.callee)?.defs[0];
        const specifier = definition?.node;
        if (definition?.type !== "ImportBinding" || specifier?.type !== "ImportSpecifier") return;
        const declaration = specifier.parent;
        if (declaration.type !== "ImportDeclaration" || !routerModules.has(String(declaration.source.value))) return;
        const imported = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
        if (imported === "redirect") calls.push(node);
      },
      "Program:exit"() {
        for (const node of calls) {
          const destination = staticPrefix(node.arguments[0]);
          if (leavesIframe.test(destination))
            context.report({
              node,
              messageId: "externalRedirect",
              data: { destination: destination.slice(0, 40) },
            });
          else if (authenticatesAdmin) context.report({ node, messageId: "preferEmbeddedRedirect" });
        }
      },
    };
  },
};
