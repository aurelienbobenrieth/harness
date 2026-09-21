import { binding, moduleMethod } from "../binding-support.js";
import type { ESTree, Rule, Context } from "@oxlint/plugins";
import { isJsonMethodCall } from "../ast.js";

const message =
  "Parse JSON through an Effect Schema JSON decoder, such as Schema.fromJsonString(...), before using the value.";

const schemaDecoders = new Set([
  "decodeUnknown",
  "decodeUnknownEffect",
  "decodeUnknownSync",
  "decodeUnknownEither",
  "decodeUnknownExit",
  "decodeUnknownOption",
  "decodeUnknownPromise",
  "decodeUnknownResult",
]);

function isEffectSchemaDecoderCall(node: ESTree.Node | undefined, context: Context): boolean {
  if (node?.type !== "CallExpression") return false;
  let callee = node.callee;
  if (callee.type === "Identifier") {
    const definition = binding(context, callee, callee.name)?.defs[0]?.node;
    if (definition?.type === "VariableDeclarator" && definition.init?.type === "CallExpression")
      callee = definition.init.callee;
  }
  if (callee.type === "CallExpression") callee = callee.callee;
  return schemaDecoders.has(moduleMethod(context, callee, "Schema") ?? "");
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
        if (isEffectSchemaDecoderCall(node.parent, context)) return;

        context.report({
          node,
          messageId: "decodeJson",
        });
      },
    };
  },
};
