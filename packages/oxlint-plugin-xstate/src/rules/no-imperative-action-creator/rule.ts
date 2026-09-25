/**
 * Forbid calling XState action creators imperatively inside a function body.
 *
 * @attribution eslint-plugin-xstate no-imperative-action by Richard Laffers (concept)
 */
import {
  binding,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import { isSetupResult } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "{{name}}() only builds an action object, so calling it inside a function does nothing: pass it directly as the action, or enqueue it inside enqueueActions() with enqueue.{{name}}(...) or enqueue({{name}}(...)).";

const actionCreators: ReadonlySet<string> = new Set([
  "assign",
  "raise",
  "sendTo",
  "sendParent",
  "forwardTo",
  "emit",
  "cancel",
  "stopChild",
  "stop",
  "spawnChild",
  "log",
  "enqueueActions",
]);

const setupBoundCreators: ReadonlySet<string> = new Set([
  "assign",
  "sendTo",
  "raise",
  "log",
  "cancel",
  "stopChild",
  "enqueueActions",
  "emit",
]);

const actionSlots: ReadonlySet<string> = new Set(["entry", "exit", "actions"]);

function destructuredSetupCreator(context: Context, node: ESTree.Node): string | undefined {
  if (node.type !== "Identifier") return undefined;
  for (const definition of binding(context, node, node.name)?.defs ?? []) {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator" || declarator.id.type !== "ObjectPattern") continue;
    if (declarator.init === null || declarator.init === undefined || !isSetupResult(context, declarator.init)) continue;
    for (const property of declarator.id.properties) {
      if (property.type !== "Property" || property.value.type !== "Identifier") continue;
      if (property.value.name !== node.name) continue;
      const key = propertyKeyName(property);
      if (key !== undefined && setupBoundCreators.has(key)) return key;
    }
  }
  return undefined;
}

function creatorName(context: Context, callee: ESTree.Node): string | undefined {
  const imported = importedName(context, callee);
  if (imported !== undefined) return actionCreators.has(imported) ? imported : undefined;
  const destructured = destructuredSetupCreator(context, callee);
  if (destructured !== undefined) return destructured;
  const member = memberPropertyName(callee);
  if (member === undefined || !setupBoundCreators.has(member) || callee.type !== "MemberExpression") return undefined;
  return isSetupResult(context, callee.object) ? member : undefined;
}

function discardedCall(expression: ESTree.Node): ESTree.Node {
  let current = unwrapExpressionKeepingChain(expression);
  while (current.type === "AwaitExpression" || (current.type === "UnaryExpression" && current.operator === "void"))
    current = unwrapExpressionKeepingChain(current.argument);
  return current;
}

function isActionSlotValue(context: Context, node: ESTree.Node): boolean {
  let holder = parentOf(node);
  if (holder?.type === "ArrayExpression") holder = parentOf(holder);
  if (holder?.type !== "Property" || holder.computed) return false;
  const key = propertyKeyName(holder);
  if (key !== undefined && actionSlots.has(key)) return true;
  const implementations = parentOf(holder);
  const slot = implementations === undefined ? undefined : parentOf(implementations);
  if (slot?.type !== "Property" || propertyKeyName(slot) !== "actions") return false;
  const setupArgument = parentOf(slot);
  const call = setupArgument === undefined ? undefined : parentOf(setupArgument);
  return (
    call?.type === "CallExpression" &&
    importedName(context, call.callee) === "setup" &&
    call.arguments[0] === setupArgument
  );
}

export const noImperativeActionCreator: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid XState action creators (assign, raise, sendTo, ...) called as discarded statements or returned from inline action functions, where they are silent no-ops.",
    },
    messages: {
      noImperativeActionCreator: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      ExpressionStatement(node) {
        const call = discardedCall(node.expression);
        if (call.type !== "CallExpression") return;
        const name = creatorName(context, call.callee);
        if (name === undefined) return;
        context.report({ node: call, messageId: "noImperativeActionCreator", data: { name } });
      },
      ArrowFunctionExpression(node) {
        if (node.body.type === "BlockStatement") return;
        const call = unwrapExpressionKeepingChain(node.body);
        if (call.type !== "CallExpression") return;
        const name = creatorName(context, call.callee);
        if (name === undefined || !isActionSlotValue(context, node)) return;
        context.report({ node: call, messageId: "noImperativeActionCreator", data: { name } });
      },
    };
  },
};
