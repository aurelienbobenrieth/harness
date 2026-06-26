import type { ESTree, Rule } from "@oxlint/plugins";
import { isIdentifier, isImmediateFunctionCallWithArgument, isJsonMethodCall } from "../ast.js";

const message =
  "Parse JSON through an Effect Schema JSON decoder, such as Schema.fromJsonString(...), before using the value.";

function isEffectSchemaDecoderCall(node: ESTree.Node | undefined, jsonParseNode: ESTree.CallExpression): boolean {
  return isImmediateFunctionCallWithArgument(
    node,
    jsonParseNode,
    (callee) => isIdentifier(callee) && callee.name.endsWith("Decoder"),
  );
}

export const noRawJsonParse: Rule = {
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
        if (!isJsonMethodCall(node, "parse")) return;
        if (isEffectSchemaDecoderCall(node.parent, node)) return;

        context.report({
          node,
          messageId: "decodeJson",
        });
      },
    };
  },
};