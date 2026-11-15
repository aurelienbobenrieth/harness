/**
 * Forbid detaching `waitUntil` / `passThroughOnException` from the execution
 * context object; called without their receiver they throw "Illegal invocation".
 *
 * @attribution https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
 */
import { binding, parentOf, propertyKeyName, unwrapExpression } from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "This detaches the execution-context method from its receiver, so calling it throws 'Illegal invocation'. Call it on the context object: `ctx.waitUntil(promise)`, `ctx.passThroughOnException()`.";

const contextMethods: ReadonlySet<string> = new Set(["waitUntil", "passThroughOnException"]);

function memberName(node: ESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string")
    return node.property.value;
  return undefined;
}

/** Climb through wrappers that pass the value through unchanged (`as`, `!`, parentheses, `?.`). */
function valueUse(node: ESTree.Node): { readonly parent: ESTree.Node | undefined; readonly child: ESTree.Node } {
  let child: ESTree.Node = node;
  let parent = parentOf(node);
  while (parent !== undefined && unwrapExpression(parent) !== parent) {
    child = parent;
    parent = parentOf(parent);
  }
  return { parent, child };
}

/**
 * True when the member value escapes its receiver: stored, passed, returned,
 * placed in an object or array, or used as a default/conditional value.
 */
function escapes(node: ESTree.MemberExpression): boolean {
  const { parent, child } = valueUse(node);
  if (parent === undefined) return false;
  switch (parent.type) {
    case "VariableDeclarator":
      return parent.init === child;
    case "AssignmentExpression":
      return parent.right === child;
    case "CallExpression":
    case "NewExpression":
      return parent.arguments.includes(child as ESTree.Expression);
    case "ReturnStatement":
    case "ArrowFunctionExpression":
    case "ArrayExpression":
    case "SpreadElement":
    case "AssignmentPattern":
      return true;
    case "ConditionalExpression":
      return parent.test !== child;
    case "LogicalExpression":
      return parent.right === child;
    case "Property":
      return parent.value === child;
    default:
      return false;
  }
}

function isModuleImport(context: Context, node: ESTree.Node, depth = 0): boolean {
  let value = unwrapExpression(node);
  if (value.type === "AwaitExpression") value = unwrapExpression(value.argument);
  if (value.type === "ImportExpression") return true;
  if (value.type !== "Identifier" || depth > 2) return false;
  return (binding(context, value, value.name)?.defs ?? []).some((definition) => {
    if (definition.type === "ImportBinding") return definition.node.type === "ImportNamespaceSpecifier";
    if (definition.node.type !== "VariableDeclarator") return false;
    const initial = definition.node.init;
    return initial !== null && initial !== undefined && isModuleImport(context, initial, depth + 1);
  });
}

/**
 * `const { waitUntil } = await import("cloudflare:workers")` reads a module export, not a context method, also
 * through a `const` or `let` that holds the module namespace first.
 */
function destructuresModule(context: Context, pattern: ESTree.Node): boolean {
  const parent = parentOf(pattern);
  if (
    parent?.type !== "VariableDeclarator" ||
    parent.id !== pattern ||
    parent.init === null ||
    parent.init === undefined
  )
    return false;
  return isModuleImport(context, parent.init);
}

export const noDetachedExecutionContextMethod: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid destructuring waitUntil / passThroughOnException from an execution context, or passing, storing, or returning them without their receiver.",
    },
    messages: {
      detachedContextMethod: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      ObjectPattern(node) {
        if (destructuresModule(context, node)) return;
        for (const property of node.properties) {
          if (property.type !== "Property") continue;
          const name = propertyKeyName(property);
          if (name !== undefined && contextMethods.has(name))
            context.report({ node: property, messageId: "detachedContextMethod" });
        }
      },
      MemberExpression(node) {
        const name = memberName(node);
        if (name === undefined || !contextMethods.has(name) || !escapes(node)) return;
        context.report({ node, messageId: "detachedContextMethod" });
      },
    };
  },
};
