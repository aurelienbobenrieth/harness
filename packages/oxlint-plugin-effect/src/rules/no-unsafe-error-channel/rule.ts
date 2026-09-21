import type { Rule } from "@oxlint/plugins";
import { isEffectNamespace, isUnsafeType } from "../binding-support.js";

export const noUnsafeErrorChannel: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow unknown and any as the Effect error channel." },
    messages: { typedErrorChannel: "Use a typed Effect error channel instead of unknown or any." },
  },
  createOnce(context) {
    return {
      TSTypeReference(node) {
        const name = node.typeName;
        if (name.type !== "TSQualifiedName" || name.right.name !== "Effect" || !isEffectNamespace(context, name.left))
          return;
        const error = node.typeArguments?.params[1];
        if (error !== undefined && isUnsafeType(context, error))
          context.report({ node: error, messageId: "typedErrorChannel" });
      },
    };
  },
};
