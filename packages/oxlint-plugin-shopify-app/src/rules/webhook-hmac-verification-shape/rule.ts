import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { resolveVariable } from "../ast-support.js";
import { firstOption, stringArrayOption } from "../option-support.js";

const headerPattern = /^x-shopify-hmac-sha256$/i;
const defaultSafeCompareNames = ["timingSafeEqual", "safeCompare"];

function isCreateHmacCall(node: ESTree.Node): boolean {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type === "Identifier") return callee.name === "createHmac";
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "createHmac"
  );
}

function rootedAtCreateHmac(context: Context, node: ESTree.Node, depth = 0): boolean {
  if (depth > 4) return false;
  let current = node;
  for (;;) {
    if (isCreateHmacCall(current)) return true;
    if (current.type === "CallExpression") current = current.callee;
    else if (current.type === "MemberExpression") current = current.object;
    else break;
  }
  if (current.type !== "Identifier") return false;
  const declarator = resolveVariable(context, current)?.defs[0]?.node;
  if (declarator?.type !== "VariableDeclarator" || declarator.init == null) return false;
  return rootedAtCreateHmac(context, declarator.init, depth + 1);
}

function isJsonStringify(node: ESTree.Node | undefined): boolean {
  if (node?.type !== "CallExpression" || node.callee.type !== "MemberExpression" || node.callee.computed) return false;
  const { object, property } = node.callee;
  return (
    object.type === "Identifier" &&
    object.name === "JSON" &&
    property.type === "Identifier" &&
    property.name === "stringify"
  );
}

/**
 * @attribution https://shopify.dev/docs/apps/build/webhooks/subscribe/https (inspiration; independently implemented)
 */
export const webhookHmacVerificationShape: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "In files reading the X-Shopify-Hmac-SHA256 header, disallow hashing JSON.stringify output and require a timing-safe comparison. Option `safeCompareNames` overrides the accepted comparison identifiers.",
    },
    messages: {
      reserializedBody:
        "The webhook HMAC is computed over re-serialised JSON, which differs from the bytes Shopify signed, so valid deliveries fail verification. Hash the raw request body.",
      unsafeComparison:
        "This file verifies the Shopify webhook HMAC without a timing-safe comparison. Compare the digests with `crypto.timingSafeEqual` on equal-length buffers.",
    },
    schema: [
      {
        type: "object",
        properties: { safeCompareNames: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let header: ESTree.Node | undefined;
    let createsHmac = false;
    let reserialized: ESTree.Node[] = [];
    let identifiers = new Set<string>();

    const noteHeader = (node: ESTree.Node, text: unknown): void => {
      if (header === undefined && typeof text === "string" && headerPattern.test(text)) header = node;
    };

    return {
      before() {
        header = undefined;
        createsHmac = false;
        reserialized = [];
        identifiers = new Set();
      },
      Literal(node) {
        noteHeader(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) noteHeader(node, node.quasis[0]?.value.cooked);
      },
      Identifier(node) {
        identifiers.add(node.name);
      },
      CallExpression(node) {
        if (isCreateHmacCall(node)) createsHmac = true;
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.property.type !== "Identifier" ||
          callee.property.name !== "update" ||
          !isJsonStringify(node.arguments[0])
        )
          return;
        if (rootedAtCreateHmac(context, callee.object)) reserialized.push(node);
      },
      "Program:exit"() {
        if (header === undefined) return;
        for (const node of reserialized) context.report({ node, messageId: "reserializedBody" });
        if (!createsHmac) return;
        const safeNames = stringArrayOption(firstOption(context), "safeCompareNames", defaultSafeCompareNames);
        if (safeNames.some((name) => identifiers.has(name))) return;
        context.report({ node: header, messageId: "unsafeComparison" });
      },
    };
  },
};
