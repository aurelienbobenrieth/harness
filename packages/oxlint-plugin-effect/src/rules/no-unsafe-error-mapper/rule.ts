import type { ESTree, Rule } from "@oxlint/plugins";
import { binding } from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod, isUnsafeType } from "../binding-support.js";

const methods = new Set(["catch", "catchAll", "catchTag", "catchTags", "mapError"]);

export const noUnsafeErrorMapper: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow unknown and any in Effect error mapper parameters." },
    messages: { unsafeMapper: "Use typed Effect error mapper parameters instead of unknown or any." },
  },
  createOnce(context) {
    const check = (node: ESTree.Node, seen: Set<ESTree.Node>): void => {
      if (seen.has(node)) return;
      seen.add(node);
      if (node.type === "Identifier") {
        for (const definition of binding(context, node, node.name)?.defs ?? []) {
          if (definition.node.type === "VariableDeclarator" && definition.node.init !== null)
            check(definition.node.init, seen);
          else if (definition.node.type === "FunctionDeclaration") check(definition.node, seen);
        }
      } else if (node.type === "ObjectExpression") {
        for (const property of node.properties) if (property.type === "Property") check(property.value, seen);
      } else if (
        node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression" ||
        node.type === "FunctionDeclaration"
      ) {
        for (const parameter of node.params) {
          const annotation = "typeAnnotation" in parameter ? parameter.typeAnnotation : undefined;
          if (annotation && isUnsafeType(context, annotation.typeAnnotation))
            context.report({ node: annotation, messageId: "unsafeMapper" });
        }
      }
    };
    return {
      CallExpression(node) {
        if (!methods.has(effectMethod(context, node.callee) ?? "")) return;
        const handler = node.arguments.at(-1);
        if (handler !== undefined) check(handler, new Set());
      },
    };
  },
};
