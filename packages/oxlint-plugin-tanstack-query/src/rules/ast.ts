import type { Context, ESTree } from "@oxlint/plugins";
import { binding } from "./binding-support.js";

export type ParentNode = ESTree.Node & {
  readonly parent?: ParentNode | null;
};

export type FunctionNode = ParentNode & {
  readonly type: "ArrowFunctionExpression" | "FunctionDeclaration" | "FunctionExpression";
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node | null;
};

export function isFunctionNode(node: ESTree.Node | null | undefined): node is FunctionNode {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression"
  );
}

export function parentOf(node: ESTree.Node): ParentNode | undefined {
  return (node as ParentNode).parent ?? undefined;
}

/** Strip TypeScript-only wrappers and parentheses that do not change the runtime value. */
export function unwrapExpression(node: ESTree.Node): ESTree.Node {
  let current = node;
  for (;;) {
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "ParenthesizedExpression"
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

function isNode(value: unknown): value is ESTree.Node {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/** Depth-first walk over a subtree; return `false` from the visitor to skip the children of a node. */
export function walk(node: ESTree.Node, visit: (node: ESTree.Node) => boolean | void): void {
  if (visit(node) === false) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const entry of value) if (isNode(entry)) walk(entry, visit);
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

/** Walk the statements and expressions a function itself executes, without entering nested functions. */
export function walkOwnBody(fn: FunctionNode, visit: (node: ESTree.Node) => void): void {
  if (fn.body === null) return;
  walk(fn.body, (node) => {
    if (isFunctionNode(node)) return false;
    visit(node);
    return true;
  });
}

export function someNode(root: ESTree.Node, predicate: (node: ESTree.Node) => boolean): boolean {
  let found = false;
  walk(root, (node) => {
    if (found) return false;
    if (predicate(node)) found = true;
    return !found;
  });
  return found;
}

/** Static name of a non-computed property key, or of a computed string-literal key. */
export function propertyName(property: ESTree.Node): string | undefined {
  if (property.type !== "Property") return undefined;
  const key = property.key;
  if (!property.computed && key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

export function findProperty(object: ESTree.ObjectExpression, name: string): ESTree.ObjectProperty | undefined {
  for (const property of object.properties) {
    if (property.type === "Property" && propertyName(property) === name) return property;
  }
  return undefined;
}

export function hasSpread(object: ESTree.ObjectExpression): boolean {
  return object.properties.some((property) => property.type === "SpreadElement");
}

/** Name of the called member or identifier: `client.setQueryData(...)` and `setQueryData(...)` both yield `setQueryData`. */
export function calleeName(call: ESTree.CallExpression): string | undefined {
  const callee = unwrapExpression(call.callee);
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier")
    return callee.property.name;
  return undefined;
}

/**
 * Resolve the function a property value denotes: an inline function, or one hop
 * to a same-file function declaration or `const` function expression.
 */
export function resolveFunction(context: Context, value: ESTree.Node): FunctionNode | undefined {
  const expression = unwrapExpression(value);
  if (isFunctionNode(expression)) return expression;
  if (expression.type !== "Identifier") return undefined;
  for (const definition of binding(context, expression, expression.name)?.defs ?? []) {
    if (isFunctionNode(definition.node)) return definition.node;
    if (definition.node.type !== "VariableDeclarator" || definition.node.init === null) continue;
    const initial = unwrapExpression(definition.node.init);
    if (isFunctionNode(initial)) return initial;
  }
  return undefined;
}

/** True when the block can finish by throwing or rejecting: a `throw`, or `return Promise.reject(...)`. */
export function rethrows(root: ESTree.Node): boolean {
  let found = false;
  walk(root, (node) => {
    if (found || (node !== root && isFunctionNode(node))) return false;
    if (node.type === "ThrowStatement") found = true;
    if (node.type === "ReturnStatement" && node.argument !== null && isPromiseReject(node.argument)) found = true;
    return !found;
  });
  return found;
}

function isPromiseReject(node: ESTree.Node): boolean {
  const expression = unwrapExpression(node);
  if (expression.type !== "CallExpression") return false;
  const callee = expression.callee;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Promise" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "reject"
  );
}

export function optionsObject(context: Context): Readonly<Record<string, unknown>> {
  const candidate = (context as { readonly options?: readonly unknown[] }).options?.[0];
  return typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : {};
}
