/**
 * Forbid calling a named action directly in a v6 handler body instead of
 * enqueueing it with `enq(actions.name, params)`.
 */
import {
  type FunctionNode,
  binding,
  memberPropertyName,
  nearestFunction,
  parentOf,
  propertyKeyName,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import { isConfigHandler } from "../v6-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "actions.{{action}}() runs the side effect while XState computes the transition, so it also fires on snapshot.can(), on pure transition(), and on re-evaluation (more than once per event). Enqueue it instead: enq(actions.{{action}}, params).";

/** True when `node` is the handler's first parameter (`args`). */
function isArgsParameter(context: Context, node: ESTree.Node, handler: FunctionNode): boolean {
  if (node.type !== "Identifier") return false;
  return (binding(context, node, node.name)?.defs ?? []).some(
    (definition) => definition.type === "Parameter" && definition.name === handler.params[0],
  );
}

/** True for an identifier declared as `{ actions }` out of the handler's `args`, in its parameter or its body. */
function isDestructuredActions(
  context: Context,
  node: ESTree.Node & { readonly name: string },
  handler: FunctionNode,
): boolean {
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    const property = parentOf(definition.name);
    if (property?.type !== "Property" || property.value !== definition.name) return false;
    if (propertyKeyName(property) !== "actions") return false;
    const pattern = parentOf(property);
    if (pattern?.type !== "ObjectPattern") return false;
    if (definition.type === "Parameter") return pattern === handler.params[0];
    const declarator = definition.node;
    return (
      definition.type === "Variable" &&
      declarator.type === "VariableDeclarator" &&
      declarator.id === pattern &&
      declarator.init !== null &&
      declarator.init !== undefined &&
      isArgsParameter(context, unwrapExpressionKeepingChain(declarator.init), handler)
    );
  });
}

/** True for the handler's actions map: `args.actions` or `actions` destructured from `args`. */
function isActionsMap(context: Context, node: ESTree.Node, handler: FunctionNode): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (value.type === "Identifier") return isDestructuredActions(context, value, handler);
  return (
    value.type === "MemberExpression" &&
    memberPropertyName(value) === "actions" &&
    isArgsParameter(context, unwrapExpressionKeepingChain(value.object), handler)
  );
}

export const noDirectNamedAction: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid calling a named action directly in a v6 handler body instead of enq(actions.name, params).",
    },
    messages: {
      noDirectNamedAction: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = unwrapExpressionKeepingChain(node.callee);
        if (callee.type !== "MemberExpression") return;
        const action = memberPropertyName(callee);
        if (action === undefined) return;
        const handler = nearestFunction(node);
        if (handler === undefined || !isActionsMap(context, callee.object, handler)) return;
        if (!isConfigHandler(context, handler)) return;
        context.report({ node, messageId: "noDirectNamedAction", data: { action } });
      },
    };
  },
};
