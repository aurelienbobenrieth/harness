import { isBoundaryFile } from "../ast.js";
/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { getReturnTypeAnnotation, readParameters, typeMatches, unwrapTypeParens, type ParameterInfo } from "../ast.js";

const message =
  'Parameter "{{name}}" is typed as unknown. Accept a named domain type and parse untrusted input at the I/O boundary.';

const emptyAliases = new Map<string, ESTree.TSType>();

function predicateSubjectName(node: ESTree.Node): string | undefined {
  const returnType = getReturnTypeAnnotation(node);
  if (returnType === undefined) return undefined;
  const target = unwrapTypeParens(returnType.typeAnnotation);
  if (target.type !== "TSTypePredicate") return undefined;
  return target.parameterName.type === "Identifier" ? target.parameterName.name : undefined;
}

function isExemptParameter(parameter: ParameterInfo, subjectName: string | undefined): boolean {
  return parameter.name !== undefined && (parameter.name === "cause" || parameter.name === subjectName);
}

export const noUnknownParameters: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unknown in parameter annotations outside type guards and error causes.",
    },
    messages: {
      unknownParameter: message,
    },
  },
  createOnce(context) {
    const check = (node: ESTree.Node): void => {
      const subjectName = predicateSubjectName(node);
      for (const parameter of readParameters(node)) {
        if (parameter.annotation === undefined) continue;
        if (isExemptParameter(parameter, subjectName)) continue;
        if (!typeMatches(parameter.annotation, (member) => member.type === "TSUnknownKeyword", emptyAliases)) continue;
        context.report({
          node: parameter.reportNode,
          messageId: "unknownParameter",
          data: { name: parameter.name ?? "(destructured)" },
        });
      }
    };

    return {
      before() {
        if (isBoundaryFile(context.filename)) return false;
      },
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSMethodSignature: check,
      TSFunctionType: check,
      TSCallSignatureDeclaration: check,
      TSConstructSignatureDeclaration: check,
      TSConstructorType: check,
    };
  },
};
