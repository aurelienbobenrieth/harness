import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isModuleNamespace } from "../sota-support.js";

const message =
  "Remove this assertion to {{type}}: asserting the error or requirement channel turns a compile-time guarantee into a runtime defect. Handle the error or provide the missing service instead.";

const channelTypes: ReadonlySet<string> = new Set(["Effect", "Layer", "Stream"]);

function assertedChannelType(context: Context, annotation: ESTree.Node): string | undefined {
  if (annotation.type !== "TSTypeReference") return undefined;
  const parameters = annotation.typeArguments?.params ?? [];
  if (parameters.length < 2) return undefined;

  const name = annotation.typeName;
  if (name.type !== "TSQualifiedName" || name.left.type !== "Identifier") return undefined;
  const moduleName = name.right.name;
  if (!channelTypes.has(moduleName) || !isModuleNamespace(context, name.left, moduleName)) return undefined;
  return `${moduleName}.${moduleName}`;
}

/**
 * Disallow asserting a value to an `Effect`, `Layer` or `Stream` type with explicit channels.
 *
 * @attribution @effect/language-service unsafeEffectTypeAssertion diagnostic (concept)
 */
export const noEffectTypeAssertion: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as` and angle-bracket assertions to Effect.Effect, Layer.Layer, or Stream.Stream types that spell out error or requirement channels.",
    },
    messages: { noEffectTypeAssertion: message },
  },
  createOnce(context) {
    function check(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void {
      const type = assertedChannelType(context, node.typeAnnotation);
      if (type === undefined) return;
      context.report({
        node: node.typeAnnotation,
        messageId: "noEffectTypeAssertion",
        data: { type },
      });
    }

    return {
      TSAsExpression: check,
      TSTypeAssertion: check,
    };
  },
};
