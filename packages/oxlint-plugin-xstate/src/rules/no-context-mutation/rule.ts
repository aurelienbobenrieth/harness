/**
 * Forbid in-place mutation of machine context and of `snapshot.context`.
 */
import {
  importsFrom,
  isFunctionNode,
  isMachineConfigCallee,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  unwrapExpression,
} from "../ast.js";
import { binding, importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "Context is shared, immutable state: this mutates it in place, which leaks across actors and hides the change from selectors. Return a new value from assign() instead.";

type RuleOptions = { readonly allowCollectionMethods?: boolean };

const arrayMutators: ReadonlySet<string> = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

const collectionMutators: ReadonlySet<string> = new Set(["set", "add", "delete", "clear"]);

const implementationHosts: ReadonlySet<string> = new Set(["setup", "createMachine", "assign", "enqueueActions"]);

const implementationHostMethods: ReadonlySet<string> = new Set(["assign", "enqueueActions", "createAction"]);

function allowsCollectionMethods(context: Context): boolean {
  const first = context.options[0];
  return typeof first === "object" && first !== null && (first as RuleOptions).allowCollectionMethods === true;
}

function isImplementationHost(context: Context, callee: ESTree.Node): boolean {
  const imported = importedName(context, callee);
  if (imported !== undefined) return implementationHosts.has(imported);
  if (isMachineConfigCallee(context, callee)) return true;
  const member = memberPropertyName(callee);
  return member !== undefined && implementationHostMethods.has(member);
}

function isInsideImplementationHost(context: Context, node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined) {
    if (
      current.type === "CallExpression" &&
      current.arguments.includes(child as ESTree.Expression) &&
      isImplementationHost(context, current.callee)
    )
      return true;
    child = current;
    current = parentOf(current);
  }
  return false;
}

function isContextParameter(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    if (definition.type !== "Parameter" || !isFunctionNode(definition.node)) return false;
    const first = definition.node.params[0];
    if (first?.type !== "ObjectPattern") return false;
    const destructured = first.properties.some(
      (property) =>
        property.type === "Property" &&
        propertyKeyName(property) === "context" &&
        property.value.type === "Identifier" &&
        property.value.name === node.name,
    );
    return destructured && isInsideImplementationHost(context, definition.node);
  });
}

function isSnapshotContext(node: ESTree.Node): boolean {
  if (memberPropertyName(node) !== "context" || node.type !== "MemberExpression") return false;
  const owner = unwrapExpression(node.object);
  if (owner.type === "Identifier") return owner.name === "snapshot";
  return owner.type === "CallExpression" && memberPropertyName(owner.callee) === "getSnapshot";
}

/** True for a member chain of depth >= 1 rooted at a destructured `context` parameter or a snapshot's `.context`. */
function isContextPath(context: Context, node: ESTree.Node): boolean {
  let current = unwrapExpression(node);
  if (current.type === "ChainExpression") current = unwrapExpression(current.expression);
  if (current.type !== "MemberExpression") return false;
  for (;;) {
    const owner = unwrapExpression(current.object);
    if (isSnapshotContext(owner)) return true;
    if (owner.type === "MemberExpression") {
      current = owner;
      continue;
    }
    return isContextParameter(context, owner);
  }
}

export const noContextMutation: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid in-place mutation of XState context (assignments, delete, and mutating array/Map/Set methods on context or snapshot.context).",
    },
    messages: {
      noContextMutation: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowCollectionMethods: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    let enabled = false;
    return {
      Program(node) {
        enabled = importsFrom(node, ["xstate", "@xstate"]);
      },
      AssignmentExpression(node) {
        if (!enabled || !isContextPath(context, node.left)) return;
        context.report({ node, messageId: "noContextMutation" });
      },
      UpdateExpression(node) {
        if (!enabled || !isContextPath(context, node.argument)) return;
        context.report({ node, messageId: "noContextMutation" });
      },
      UnaryExpression(node) {
        if (!enabled || node.operator !== "delete" || !isContextPath(context, node.argument)) return;
        context.report({ node, messageId: "noContextMutation" });
      },
      CallExpression(node) {
        if (!enabled || node.callee.type !== "MemberExpression") return;
        const method = memberPropertyName(node.callee);
        if (method === undefined) return;
        const mutates =
          arrayMutators.has(method) || (collectionMutators.has(method) && !allowsCollectionMethods(context));
        if (!mutates || !isContextPath(context, node.callee.object)) return;
        context.report({ node, messageId: "noContextMutation" });
      },
    };
  },
};
