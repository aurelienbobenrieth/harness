import { isBoundaryFile } from "../ast.js";
/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { collectAlias, getReturnTypeAnnotation, isTypeReferenceNamed, typeMatches, type AliasMap } from "../ast.js";

const message =
  "This return type erases what the function actually produces. Return a named domain type, or parse before returning.";

function returnsUnknown(type: ESTree.TSType, aliases: AliasMap, seen = new Set<string>()): boolean {
  return typeMatches(
    type,
    (member) => {
      if (member.type === "TSUnknownKeyword") return true;
      if (!isTypeReferenceNamed(member, "Promise") && !isTypeReferenceNamed(member, "PromiseLike")) return false;
      const resolvedValue = member.typeArguments?.params[0];
      return resolvedValue !== undefined && returnsUnknown(resolvedValue, aliases, seen);
    },
    aliases,
    seen,
  );
}

export const noUnknownReturns: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unknown in return type annotations, including inside Promise results.",
    },
    messages: {
      unknownReturn: message,
    },
  },
  createOnce(context) {
    const aliases: AliasMap = new Map();
    let pending: ESTree.TSTypeAnnotation[] = [];

    const collect = (node: ESTree.Node): void => {
      const returnType = getReturnTypeAnnotation(node);
      if (returnType !== undefined) pending.push(returnType);
    };

    return {
      before() {
        if (isBoundaryFile(context.filename)) return false;
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
        for (const returnType of pending) {
          if (!returnsUnknown(returnType.typeAnnotation, aliases)) continue;
          context.report({ node: returnType, messageId: "unknownReturn" });
        }
      },
    };
  },
};
