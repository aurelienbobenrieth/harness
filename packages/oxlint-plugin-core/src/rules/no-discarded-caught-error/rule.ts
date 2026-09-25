import type { Comment, Context, ESTree, Rule } from "@oxlint/plugins";
import { inlineRejectionHandler, someOwnDescendant, type InlineFunction } from "../ast-support.js";
import { isTestFile, type RuleContextWithFilename } from "../filename-support.js";

const defaultLogOnlyCallees = ["console", "logger", "log"] as const;
const defaultReasonMarker = "REASON";
const minimumReasonWords = 3;
const placeholderReasonPattern = /^(?:todo|fixme|ignore[ds]?|intentional(?:ly)?|trust me|this is (?:fine|safe|ok))\b/i;
const passThroughParentTypes = new Set([
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "ParenthesizedExpression",
  "ChainExpression",
  "TemplateLiteral",
  "ObjectExpression",
  "ArrayExpression",
  "SpreadElement",
]);

type Options = {
  readonly logOnlyCallees?: readonly string[];
  readonly reasonMarker?: string;
  readonly includeTestFiles?: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function calleePath(node: ESTree.Node): readonly string[] | undefined {
  if (node.type === "Identifier") return [node.name];
  if (node.type === "ThisExpression") return ["this"];
  if (node.type === "ChainExpression") return calleePath(node.expression);
  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") return undefined;
  const parent = calleePath(node.object);
  return parent === undefined ? undefined : [...parent, node.property.name];
}

function isLogCall(call: ESTree.CallExpression, logOnlyCallees: ReadonlySet<string>): boolean {
  const path = calleePath(call.callee);
  return path !== undefined && path.length > 1 && path.slice(0, -1).some((segment) => logOnlyCallees.has(segment));
}

/** A reference is log-only when the value it contributes to ends up as an argument of a logging call. */
function isLogOnlyReference(identifier: ESTree.Node, logOnlyCallees: ReadonlySet<string>): boolean {
  let current = identifier;
  for (;;) {
    const parent = current.parent;
    if (parent === null || parent === undefined) return false;
    if (parent.type === "CallExpression") {
      return parent.arguments.includes(current as ESTree.Expression) && isLogCall(parent, logOnlyCallees);
    }
    const passesThrough =
      passThroughParentTypes.has(parent.type) ||
      (parent.type === "Property" && parent.value === current) ||
      (parent.type === "MemberExpression" && parent.object === current) ||
      (parent.type === "BinaryExpression" && parent.operator === "+");
    if (!passesThrough) return false;
    current = parent;
  }
}

function isRethrow(node: ESTree.Node): boolean {
  if (node.type === "ThrowStatement") return true;
  if (node.type !== "CallExpression") return false;
  const path = calleePath(node.callee);
  return path !== undefined && path.length === 2 && path[0] === "Promise" && path[1] === "reject";
}

function hasReason(comments: readonly Comment[], marker: string): boolean {
  const pattern = new RegExp(`${escapeRegExp(marker)}:[^\\S\\n]*([^\\n]+)`, "u");
  return comments.some((comment) => {
    const reason = pattern.exec(comment.value)?.[1]?.trim();
    return (
      reason !== undefined && reason.split(/\s+/).length >= minimumReasonWords && !placeholderReasonPattern.test(reason)
    );
  });
}

function owningStatement(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (current.parent !== null && current.parent !== undefined && !current.type.endsWith("Statement")) {
    if (current.type === "VariableDeclaration") break;
    current = current.parent;
  }
  return current;
}

export const noDiscardedCaughtError: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a catch clause or inline promise rejection handler that never rethrows and ignores or only logs the error to carry a reasoned marker comment.",
    },
    schema: [
      {
        type: "object",
        properties: {
          logOnlyCallees: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
          },
          reasonMarker: { type: "string", minLength: 1 },
          includeTestFiles: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      discardedCaughtError:
        'This handler turns a failure into a normal result without inspecting the error. Rethrow it with its cause, branch on the error, or state why discarding is correct in a "{{marker}}: <reason>" comment inside the handler.',
    },
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    if (options.includeTestFiles !== true && isTestFile(context as RuleContextWithFilename)) return {};

    const marker = options.reasonMarker ?? defaultReasonMarker;
    const logOnlyCallees = new Set(options.logOnlyCallees ?? defaultLogOnlyCallees);

    const discardsError = (scopeNode: ESTree.Node, body: ESTree.Node, binding: ESTree.Node | null | undefined) => {
      if (someOwnDescendant(context as Context, body, isRethrow)) return false;
      if (binding === null || binding === undefined) return true;
      if (binding.type !== "Identifier") return false;
      const variable = context.sourceCode
        .getDeclaredVariables(scopeNode)
        .find((candidate) => candidate.name === binding.name);
      if (variable === undefined) return false;
      return variable.references.every((reference) => isLogOnlyReference(reference.identifier, logOnlyCallees));
    };

    const checkHandler = (call: ESTree.CallExpression, handler: InlineFunction): void => {
      if (!discardsError(handler, handler, handler.params[0])) return;
      const statement = owningStatement(call);
      const comments = [
        ...context.sourceCode.getCommentsBefore(statement),
        ...context.sourceCode.getCommentsInside(call).filter((comment) => comment.start >= call.callee.end),
      ];
      if (hasReason(comments, marker)) return;
      context.report({ node: handler, messageId: "discardedCaughtError", data: { marker } });
    };

    return {
      CatchClause(node) {
        const comments = context.sourceCode.getCommentsInside(node);
        if (node.body.body.length === 0 && comments.length === 0) return;
        if (!discardsError(node, node.body, node.param)) return;
        if (hasReason(comments, marker)) return;
        context.report({ node, messageId: "discardedCaughtError", data: { marker } });
      },
      CallExpression(node) {
        const handler = inlineRejectionHandler(node);
        if (handler !== undefined) checkHandler(node, handler);
      },
    };
  },
};
