import {
  binding,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";
import { importedName } from "./binding-support.js";

export function findProperty(node: ESTree.Node, name: string): ESTree.ObjectProperty | undefined {
  if (node.type !== "ObjectExpression") return undefined;
  for (const property of node.properties) {
    if (property.type === "Property" && propertyKeyName(property) === name) return property;
  }
  return undefined;
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
  const value = unwrapExpressionKeepingChain(node);
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
