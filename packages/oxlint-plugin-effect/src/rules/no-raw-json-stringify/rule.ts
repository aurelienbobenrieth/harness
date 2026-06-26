import type { Rule } from "@oxlint/plugins";
import { isJsonMethodCall } from "../ast.js";

const message =
  "Stringify JSON through an Effect Schema JSON encoder, such as Schema.encodeUnknownSync(Schema.fromJsonString(...))(value), before emitting the value.";

export const noRawJsonStringify: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require Effect Schema encoding instead of raw JSON.stringify.",
    },
    messages: {
      encodeJson: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isJsonMethodCall(node, "stringify")) return;

        context.report({
          node,
          messageId: "encodeJson",
        });
      },
    };
  },
};