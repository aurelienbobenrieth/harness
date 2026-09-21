/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { collectAlias, readParameters, typeMatches, type AliasMap, type ParameterInfo } from "../ast.js";

const message =
  'Parameter "{{name}}" is typed as object, which carries no usable shape. Declare the properties the function actually reads in a named contract.';

export const noObjectParameters: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow parameter annotations that resolve to the shapeless object keyword.",
    },
    messages: {
      objectParameter: message,
    },
  },
  createOnce(context) {
    const aliases: AliasMap = new Map();
    let pending: ParameterInfo[] = [];

    const collect = (node: ESTree.Node): void => {
      pending.push(...readParameters(node));
    };

    return {
      before() {
        aliases.clear();
        pending = [];
      },
      TSTypeAliasDeclaration(node) {
        collectAlias(aliases, node);
      },
      FunctionDeclaration: collect,
      FunctionExpression: collect,
      ArrowFunctionExpression: collect,
      TSMethodSignature: collect,
      TSFunctionType: collect,
      TSCallSignatureDeclaration: collect,
      TSConstructSignatureDeclaration: collect,
      TSConstructorType: collect,
      "Program:exit"() {
        for (const parameter of pending) {
          if (parameter.annotation === undefined) continue;
          if (!typeMatches(parameter.annotation, (member) => member.type === "TSObjectKeyword", aliases)) continue;
          context.report({
            node: parameter.reportNode,
            messageId: "objectParameter",
            data: { name: parameter.name ?? "(destructured)" },
          });
        }
      },
    };
  },
};
