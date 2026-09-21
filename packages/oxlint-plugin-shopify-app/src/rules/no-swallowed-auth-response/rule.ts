import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { destructuredFrom, isAuthenticateCall, isFunctionNode, memberPath } from "../ast-support.js";

const message =
  "`{{call}}` signals redirects, bounce pages and 401s by throwing a Response, and this catch block never rethrows, so the auth or billing flow turns into an error result. Call it outside the try, or rethrow with `if (error instanceof Response) throw error;`.";

const authenticateMembers = new Set(["admin", "webhook", "flow", "fulfillmentService", "pos"]);
const contextMethods: Readonly<Record<string, ReadonlySet<string>>> = {
  billing: new Set(["require", "request", "cancel", "updateUsageCappedAmount"]),
  scopes: new Set(["request"]),
};
const adminOnly = new Set(["admin"]);

function throwingCall(context: Context, node: ESTree.CallExpression): string | undefined {
  if (node.callee.type === "Identifier") {
    const isEmbeddedRedirect =
      node.callee.name === "redirect" &&
      destructuredFrom(context, node.callee, (init) => isAuthenticateCall(init, adminOnly));
    return isEmbeddedRedirect ? "redirect" : undefined;
  }
  const path = memberPath(node.callee);
  if (path === undefined || path.length < 2) return undefined;
  const method = path.at(-1) ?? "";
  const owner = path.at(-2) ?? "";
  const matches =
    (owner === "authenticate" && authenticateMembers.has(method)) ||
    (path.length >= 3 && path.at(-3) === "authenticate" && owner === "public") ||
    contextMethods[owner]?.has(method) === true;
  return matches ? path.slice(path.at(-3) === "authenticate" ? -3 : -2).join(".") : undefined;
}

function preservesResponse(node: ESTree.Node): boolean {
  if (node.type === "ThrowStatement") return true;
  if (
    node.type === "BinaryExpression" &&
    node.operator === "instanceof" &&
    node.right.type === "Identifier" &&
    node.right.name === "Response"
  )
    return true;
  if (isFunctionNode(node)) return false;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    const children: readonly unknown[] = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (typeof child === "object" && child !== null && "type" in child && preservesResponse(child as ESTree.Node))
        return true;
    }
  }
  return false;
}

function swallowingTry(node: ESTree.Node): ESTree.TryStatement | undefined {
  let child: ESTree.Node = node;
  let current: ESTree.Node | null | undefined = node.parent;
  while (current && !isFunctionNode(current)) {
    if (
      current.type === "TryStatement" &&
      current.block === child &&
      current.handler != null &&
      !preservesResponse(current.handler.body)
    )
      return current;
    child = current;
    current = current.parent;
  }
  return undefined;
}

/**
 * @attribution https://github.com/Shopify/shopify-app-js (inspiration; independently implemented)
 */
export const noSwallowedAuthResponse: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow authenticate.*, billing.require/request/cancel/updateUsageCappedAmount, scopes.request and the embedded redirect helper inside a try whose catch never rethrows, because they throw a Response as control flow.",
    },
    messages: {
      noSwallowedAuthResponse: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const call = throwingCall(context, node);
        if (call === undefined || swallowingTry(node) === undefined) return;
        context.report({ node, messageId: "noSwallowedAuthResponse", data: { call } });
      },
    };
  },
};
