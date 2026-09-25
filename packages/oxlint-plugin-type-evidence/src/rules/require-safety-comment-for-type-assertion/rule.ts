/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { Comment, Context, ESTree, Rule } from "@oxlint/plugins";
import { escapeRegExp, findAncestor, isConstAssertion, type ParentedNode } from "../ast.js";

const message =
  'Type assertion lacks a safety justification. Precede the owning statement with a "{{markers}}: <reason>" comment, or parse the value instead.';

const defaultMarkers = ["SAFETY"] as const;

const owningStatementTypes = new Set([
  "ExpressionStatement",
  "VariableDeclaration",
  "ReturnStatement",
  "ThrowStatement",
  "PropertyDefinition",
]);

type RuleContextWithOptions = {
  readonly options?: readonly unknown[];
};

function getMarkers(context: RuleContextWithOptions): readonly string[] {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null || !("markers" in candidate)) return defaultMarkers;

  const markers = (candidate as { readonly markers?: unknown }).markers;
  const isValid =
    Array.isArray(markers) && markers.length > 0 && markers.every((entry) => typeof entry === "string" && entry !== "");
  return isValid ? markers : defaultMarkers;
}

function findOwningStatement(node: ESTree.Node): ESTree.Node | undefined {
  const owner = findAncestor(node, (candidate) => owningStatementTypes.has(candidate.type));
  if (owner === undefined) return undefined;

  const parent = (owner as ParentedNode).parent;
  const isExported = parent?.type === "ExportNamedDeclaration" || parent?.type === "ExportDefaultDeclaration";
  return isExported ? parent : owner;
}

function markerPattern(markers: readonly string[]): RegExp {
  return new RegExp(`(?:${markers.map(escapeRegExp).join("|")}):[^\\S\\n]*([^\\n]+)`, "u");
}

function hasSafetyComment(
  context: Context,
  assertion: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
  statement: ESTree.Node,
  pattern: RegExp,
): boolean {
  const before = context.sourceCode.getCommentsBefore(statement);
  const inside = context.sourceCode
    .getCommentsInside(statement)
    .filter((comment: Comment) => comment.end <= assertion.start);
  return [...before, ...inside].some((comment: Comment) => {
    const reason = pattern.exec(comment.value)?.[1]?.trim();
    return (
      reason !== undefined &&
      reason.split(/\s+/).length >= 3 &&
      !/^(?:todo|fixme|trust me|this is safe)\b/i.test(reason)
    );
  });
}

export const requireSafetyCommentForTypeAssertion: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require every non-const type assertion to carry a marker comment justifying its safety.",
    },
    messages: {
      missingSafetyComment: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          markers: {
            type: "array",
            items: { type: "string", minLength: 1 },
            minItems: 1,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ markers: [...defaultMarkers] }],
  },
  createOnce(context) {
    const check = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      if (isConstAssertion(node)) return;

      const markers = getMarkers(context as RuleContextWithOptions);
      const statement = findOwningStatement(node) ?? node;
      if (hasSafetyComment(context, node, statement, markerPattern(markers))) return;

      context.report({ node, messageId: "missingSafetyComment", data: { markers: markers.join('" or "') } });
    };

    return {
      TSAsExpression: check,
      TSTypeAssertion: check,
    };
  },
};
