/**
 * Require query and mutation functions to reject when their work fails.
 *
 * @attribution "React Query FAQs" by Dominik Dorfmeister, tkdodo.eu (concept)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { type FunctionNode, isFunctionNode, parentOf, rethrows, unwrapExpression, walk, walkOwnBody } from "../ast.js";
import { queryAndMutationFunctionNames, queryFunction } from "../query-function.js";

const swallowedCatch =
  "This catch block ends without throwing, so the query resolves as a success with no data: no retry, no error state. Rethrow the error, or remove the try/catch and let the function reject.";
const swallowedPromiseCatch =
  "This .catch() handler resolves instead of rejecting, so a failed request is reported as a success. Rethrow inside the handler or drop it and let the function reject.";

/** True when the try statement decides what the function resolves to, as opposed to guarding a side effect. */
function governsResult(statement: ESTree.TryStatement, fn: FunctionNode): boolean {
  if (returnsOrAssigns(statement.block) || (statement.handler !== null && returnsOrAssigns(statement.handler.body)))
    return true;
  const body = fn.body;
  return body?.type === "BlockStatement" && body.body.at(-1) === statement;
}

function returnsOrAssigns(block: ESTree.Node): boolean {
  let found = false;
  walk(block, (node) => {
    if (found || isFunctionNode(node)) return false;
    if (node.type === "ReturnStatement") found = true;
    if (node.type === "AssignmentExpression" && node.left.type === "Identifier") found = true;
    return !found;
  });
  return found;
}

/** A `.catch(handler)` whose value flows on: returned, awaited into a binding, or chained, but not a detached statement. */
function feedsResult(call: ESTree.CallExpression): boolean {
  let current: ESTree.Node = call;
  for (;;) {
    const parent = parentOf(current);
    if (parent === undefined) return false;
    if (
      parent.type === "AwaitExpression" ||
      parent.type === "ChainExpression" ||
      parent.type === "ParenthesizedExpression" ||
      parent.type === "TSAsExpression" ||
      parent.type === "TSNonNullExpression" ||
      parent.type === "TSSatisfiesExpression" ||
      (parent.type === "MemberExpression" && parent.object === current) ||
      (parent.type === "CallExpression" && parent.callee === current)
    ) {
      current = parent;
      continue;
    }
    if (parent.type === "ExpressionStatement") return false;
    return !(parent.type === "UnaryExpression" && parent.operator === "void");
  }
}

function swallowingCatchCall(node: ESTree.Node): boolean {
  if (node.type !== "CallExpression" || node.arguments.length !== 1) return false;
  const callee = node.callee;
  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.property.type !== "Identifier" ||
    callee.property.name !== "catch"
  )
    return false;
  const handler = node.arguments[0];
  if (handler === undefined || handler.type === "SpreadElement") return false;
  const fn = unwrapExpression(handler);
  if (!isFunctionNode(fn) || fn.body === null) return false;
  return !rethrows(fn.body) && feedsResult(node);
}

export const noSwallowedQueryFnError: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow queryFn/mutationFn bodies that catch a failure without rethrowing, which turns errors into successful undefined data.",
    },
    messages: { swallowedCatch, swallowedPromiseCatch },
    schema: [],
  },
  createOnce(context) {
    return {
      Property(node) {
        const fn = queryFunction(context, node, queryAndMutationFunctionNames);
        if (fn === undefined || fn.body === null) return;
        const inspect = (candidate: ESTree.Node): void => {
          if (candidate.type === "TryStatement") {
            const handler = candidate.handler;
            if (handler !== null && !rethrows(handler.body) && governsResult(candidate, fn))
              context.report({ node: handler, messageId: "swallowedCatch" });
          }
          if (swallowingCatchCall(candidate)) context.report({ node: candidate, messageId: "swallowedPromiseCatch" });
        };
        walkOwnBody(fn, inspect);
      },
    };
  },
};
