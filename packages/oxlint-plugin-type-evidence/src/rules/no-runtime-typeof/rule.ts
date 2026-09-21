import { isBoundaryFile, readParameters } from "../ast.js";
/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { hasTypePredicateReturn, nearestFunction, unwrapExpressionParens, type ParentedNode } from "../ast.js";

const message =
  "This project models internal variants with discriminated unions. Model the variants as a discriminated union, or parse the value at its boundary.";

const comparisonOperators = new Set(["===", "!==", "==", "!="]);

type RuleContextWithOptions = {
  readonly options?: readonly unknown[];
};

function allowsTypeGuards(context: RuleContextWithOptions): boolean {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null || !("allowInTypeGuards" in candidate)) return true;
  const value = (candidate as { readonly allowInTypeGuards?: unknown }).allowInTypeGuards;
  return typeof value === "boolean" ? value : true;
}

function isUndefinedStringLiteral(expression: ESTree.Node): boolean {
  const unwrapped = unwrapExpressionParens(expression);
  return unwrapped.type === "Literal" && (unwrapped as ESTree.StringLiteral).value === "undefined";
}

function isExistenceProbe(node: ESTree.UnaryExpression): boolean {
  let child: ESTree.Node = node;
  let parent = (node as ParentedNode).parent ?? undefined;
  while (parent !== undefined && parent !== null && parent.type === "ParenthesizedExpression") {
    child = parent;
    parent = (parent as ParentedNode).parent ?? undefined;
  }
  if (parent === undefined || parent === null || parent.type !== "BinaryExpression") return false;
  const binary = parent as ESTree.BinaryExpression;
  if (!comparisonOperators.has(binary.operator)) return false;
  const other = binary.left === child ? binary.right : binary.left;
  return isUndefinedStringLiteral(other);
}

function isInsideTypeGuard(node: ESTree.Node): boolean {
  const owner = nearestFunction(node);
  return owner !== undefined && hasTypePredicateReturn(owner);
}

export const noRuntimeTypeof: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow runtime typeof checks outside existence probes and type guard functions.",
    },
    messages: {
      runtimeTypeof: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowInTypeGuards: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypeGuards: true }],
  },
  createOnce(context) {
    return {
      UnaryExpression(node) {
        if (node.operator !== "typeof") return;
        if (isBoundaryFile(context.filename)) return;
        const owner = nearestFunction(node);
        const subjectName = node.argument.type === "Identifier" ? node.argument.name : undefined;
        if (
          allowsTypeGuards(context as RuleContextWithOptions) &&
          owner &&
          subjectName !== undefined &&
          readParameters(owner).some(
            (parameter) => parameter.name === subjectName && parameter.annotation?.type === "TSUnknownKeyword",
          )
        )
          return;
        if (isExistenceProbe(node)) return;
        if (allowsTypeGuards(context as RuleContextWithOptions) && isInsideTypeGuard(node)) return;
        context.report({ node, messageId: "runtimeTypeof" });
      },
    };
  },
};
