import { defineRule, type ESTree } from "@oxlint/plugins";

const message =
  "Parse JSON through an Effect Schema decoder, such as Schema.fromJsonString(...), before using the value.";

type IdentifierLike = ESTree.Node & {
  readonly type: "Identifier";
  readonly name: string;
};

function isIdentifier(node: ESTree.Node | undefined, name?: string): node is IdentifierLike {
  return node?.type === "Identifier" && "name" in node && (name === undefined || node.name === name);
}

function isJsonParse(node: ESTree.Node | undefined): node is ESTree.CallExpression {
  return (
    node?.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    isIdentifier(node.callee.object, "JSON") &&
    isIdentifier(node.callee.property, "parse")
  );
}

function isEffectSchemaDecoderCall(node: ESTree.Node | undefined, jsonParseNode: ESTree.CallExpression): boolean {
  if (node?.type !== "CallExpression") return false;
  if (!node.arguments.includes(jsonParseNode)) return false;

  return isIdentifier(node.callee) && node.callee.name.endsWith("Decoder");
}

export const noRawJsonParse = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require Effect Schema decoding for JSON.parse results.",
    },
    messages: {
      decodeJson: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isJsonParse(node)) return;
        if (isEffectSchemaDecoderCall(node.parent, node)) return;

        context.report({
          node,
          messageId: "decodeJson",
        });
      },
    };
  },
});
