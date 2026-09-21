import type { Context, ESTree } from "@oxlint/plugins";
import { binding, importedName } from "./binding-support.js";

export type ParentNode = ESTree.Node & {
  readonly parent?: ParentNode | null;
};

export type FunctionNode = ParentNode & {
  readonly type: "ArrowFunctionExpression" | "FunctionDeclaration" | "FunctionExpression";
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node | null;
  readonly id?: ESTree.Node | null;
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

export function nearestFunction(node: ESTree.Node): FunctionNode | undefined {
  let current = parentOf(node);
  while (current !== undefined) {
    if (isFunctionNode(current)) return current;
    current = parentOf(current);
  }
  return undefined;
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

export function stringLiteralValue(node: ESTree.Node | null | undefined): string | undefined {
  if (node === null || node === undefined) return undefined;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/** Static key of a non-computed property, whether written as an identifier or a string literal. */
export function propertyKeyName(node: ESTree.Node): string | undefined {
  if (node.type !== "Property" || node.computed) return undefined;
  if (node.key.type === "Identifier") return node.key.name;
  return stringLiteralValue(node.key);
}

export function findProperty(node: ESTree.Node, name: string): ESTree.ObjectProperty | undefined {
  if (node.type !== "ObjectExpression") return undefined;
  for (const property of node.properties) {
    if (property.type === "Property" && propertyKeyName(property) === name) return property;
  }
  return undefined;
}

export function memberPropertyName(node: ESTree.Node): string | undefined {
  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") return undefined;
  return node.property.name;
}

/** Depth-first walk over child nodes; return `false` from the visitor to skip a subtree. */
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

function isNode(value: unknown): value is ESTree.Node {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/** True when the file imports from any of the given module sources (exact match or `<source>/…`). */
export function importsFrom(program: ESTree.Node, sources: readonly string[]): boolean {
  if (program.type !== "Program") return false;
  return program.body.some((statement) => {
    if (statement.type !== "ImportDeclaration") return false;
    const source = String(statement.source.value);
    return sources.some((candidate) => source === candidate || source.startsWith(`${candidate}/`));
  });
}

/**
 * True for a value produced by `setup(...)`: the call itself, a chained
 * `.extend(...)`, or an identifier initialised by either.
 */
export function isSetupResult(context: Context, node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "CallExpression") {
    if (importedName(context, value.callee) === "setup") return true;
    return memberPropertyName(value.callee) === "extend" && value.callee.type === "MemberExpression"
      ? isSetupResult(context, value.callee.object)
      : false;
  }
  if (value.type !== "Identifier") return false;
  return (binding(context, value, value.name)?.defs ?? []).some((definition) => {
    if (definition.node.type !== "VariableDeclarator") return false;
    const initial = definition.node.init;
    return initial !== null && initial !== undefined && initial !== value && isSetupResult(context, initial);
  });
}

const configMethodNames: ReadonlySet<string> = new Set(["createMachine", "createStateConfig"]);

/**
 * True for callees whose first argument is machine config: `createMachine`
 * imported from `xstate`, and `<setup>.createMachine` / `<setup>.createStateConfig`.
 */
export function isMachineConfigCallee(context: Context, callee: ESTree.Node): boolean {
  if (importedName(context, callee) === "createMachine") return true;
  const name = memberPropertyName(callee);
  return name !== undefined && configMethodNames.has(name);
}

/** True when the node sits inside the first argument of a machine-config call. */
export function isInsideMachineConfig(context: Context, node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined) {
    if (
      current.type === "CallExpression" &&
      current.arguments[0] === child &&
      isMachineConfigCallee(context, current.callee)
    )
      return true;
    child = current;
    current = parentOf(current);
  }
  return false;
}
