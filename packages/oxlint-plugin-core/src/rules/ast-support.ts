import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

export type InlineFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

const functionNodeTypes = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const transparentWrapperTypes = new Set([
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "ParenthesizedExpression",
  "ChainExpression",
]);

function isNode(value: unknown): value is ESTree.Node {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

export function isInlineFunction(node: ESTree.Node | undefined | null): node is InlineFunction {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

/** Strips type-only and grouping wrappers that do not change the runtime value. */
export function unwrapExpression(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (transparentWrapperTypes.has(current.type)) {
    current = (current as unknown as { readonly expression: ESTree.Node }).expression;
  }
  return current;
}

/** Climbs from a node to the outermost type-only or grouping wrapper that still denotes the same value. */
export function outermostWrapper(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (current.parent !== null && current.parent !== undefined && transparentWrapperTypes.has(current.parent.type)) {
    current = current.parent;
  }
  return current;
}

/** Visits every descendant that executes as part of `root` itself, skipping the bodies of nested functions. */
export function someOwnDescendant(
  context: Context,
  root: ESTree.Node,
  predicate: (node: ESTree.Node) => boolean,
): boolean {
  const keys = context.sourceCode.visitorKeys;
  const visit = (node: ESTree.Node, isRoot: boolean): boolean => {
    if (!isRoot && functionNodeTypes.has(node.type)) return false;
    if (predicate(node)) return true;
    for (const key of keys[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        if (child.some((entry) => isNode(entry) && visit(entry, false))) return true;
      } else if (isNode(child) && visit(child, false)) return true;
    }
    return false;
  };
  return visit(root, true);
}

/** Visits every descendant of `root`, nested functions included. */
export function someDescendant(
  context: Context,
  root: ESTree.Node,
  predicate: (node: ESTree.Node) => boolean,
): boolean {
  const keys = context.sourceCode.visitorKeys;
  const visit = (node: ESTree.Node): boolean => {
    if (predicate(node)) return true;
    for (const key of keys[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        if (child.some((entry) => isNode(entry) && visit(entry))) return true;
      } else if (isNode(child) && visit(child)) return true;
    }
    return false;
  };
  return visit(root);
}

/** Resolves an identifier reference to its variable; globals resolve to `undefined` or a variable without definitions. */
export function resolveVariable(context: Context, identifier: ESTree.Node): Variable | undefined {
  if (identifier.type !== "Identifier") return undefined;
  let scope: Scope | null = context.sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return undefined;
}

function memberPropertyName(node: ESTree.Node): string | undefined {
  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") return undefined;
  return node.property.name;
}

/**
 * Returns the inline rejection handler of `promise.catch(fn)` or `promise.then(ok, fn)`.
 * Capitalized receivers (`Effect.catch`, `Option.catch`) are namespaces, never promise instances.
 */
export function inlineRejectionHandler(node: ESTree.CallExpression): InlineFunction | undefined {
  const callee = unwrapExpression(node.callee);
  const method = memberPropertyName(callee);
  if (method !== "catch" && method !== "then") return undefined;
  const receiver = unwrapExpression((callee as ESTree.MemberExpression).object);
  if (receiver.type === "Identifier" && /^[A-Z]/.test(receiver.name)) return undefined;
  const handler = method === "catch" ? node.arguments[0] : node.arguments[1];
  return isInlineFunction(handler) ? handler : undefined;
}

/** True when the identifier is bound by a `catch (binding)` clause or is the first parameter of an inline rejection handler. */
export function isCaughtErrorBinding(context: Context, identifier: ESTree.Node): boolean {
  const variable = resolveVariable(context, identifier);
  if (variable === undefined) return false;
  return variable.defs.some((definition) => {
    if (definition.type === "CatchClause") return true;
    if (definition.type !== "Parameter" || !isInlineFunction(definition.node)) return false;
    const call = definition.node.parent;
    return (
      call?.type === "CallExpression" &&
      inlineRejectionHandler(call) === definition.node &&
      definition.node.params[0] === definition.name
    );
  });
}
