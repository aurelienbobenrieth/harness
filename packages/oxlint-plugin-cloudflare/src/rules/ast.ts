import {
  binding,
  importedNameFrom,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";

/** True when the file imports from any of the given module sources (exact match). */
function importsFrom(program: ESTree.Node, sources: readonly string[]): boolean {
  if (program.type !== "Program") return false;
  return program.body.some(
    (statement) => statement.type === "ImportDeclaration" && sources.includes(String(statement.source.value)),
  );
}

const handlerNames: ReadonlySet<string> = new Set(["fetch", "queue", "scheduled", "email", "tail", "trace", "test"]);

function isHandlerObject(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type !== "ObjectExpression") return false;
  return value.properties.some((property) => {
    const name = property.type === "Property" ? propertyKeyName(property) : undefined;
    return name !== undefined && handlerNames.has(name);
  });
}

/**
 * True for a Worker module: it imports `cloudflare:workers`, or its default
 * export is a handler object (`fetch`, `queue`, `scheduled`, ...), directly or
 * through a module-level binding.
 */
export function isWorkerModule(context: Context, program: ESTree.Node): boolean {
  if (program.type !== "Program") return false;
  if (importsFrom(program, ["cloudflare:workers"])) return true;
  return program.body.some((statement) => {
    if (statement.type !== "ExportDefaultDeclaration") return false;
    const declaration = statement.declaration as ESTree.Node;
    if (isHandlerObject(declaration)) return true;
    const value = unwrapExpression(declaration);
    if (value.type !== "Identifier") return false;
    return (binding(context, value, value.name)?.defs ?? []).some(
      (definition) =>
        definition.node.type === "VariableDeclarator" &&
        definition.node.init !== null &&
        definition.node.init !== undefined &&
        isHandlerObject(definition.node.init),
    );
  });
}

type ClassNode = ESTree.Class;

/** True for a class whose superclass is one of `names`, imported from `cloudflare:workers`. */
export function extendsWorkersClass(context: Context, node: ClassNode, names: readonly string[]): boolean {
  if (node.superClass === null || node.superClass === undefined) return false;
  const imported = importedNameFrom(context, node.superClass, ["cloudflare:workers"]);
  return imported !== undefined && names.includes(imported);
}

/** Nearest enclosing class declaration or expression. */
export function enclosingClass(node: ESTree.Node): ClassNode | undefined {
  let current = parentOf(node);
  while (current !== undefined) {
    if (current.type === "ClassDeclaration" || current.type === "ClassExpression") return current;
    current = parentOf(current);
  }
  return undefined;
}

/** Method (`MethodDefinition`) whose value is the given function, if any. */
export function methodOf(fn: ESTree.Node): ESTree.MethodDefinition | undefined {
  const parent = parentOf(fn);
  return parent?.type === "MethodDefinition" && parent.value === fn ? parent : undefined;
}

/** True when `name` resolves to a declaration in the file rather than to the runtime global. */
export function isShadowed(context: Context, node: ESTree.Node, name: string): boolean {
  return (binding(context, node, name)?.defs.length ?? 0) > 0;
}

/** True for a call to `<object>.<method>()` where `<object>` is the global with that name (not shadowed). */
function isGlobalMemberCall(context: Context, node: ESTree.Node, object: string, method: string): boolean {
  if (node.type !== "CallExpression") return false;
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression" || memberPropertyName(callee) !== method) return false;
  const owner = unwrapExpression(callee.object);
  return owner.type === "Identifier" && owner.name === object && !isShadowed(context, owner, object);
}

/**
 * True for a runtime-nondeterministic expression: `Date.now()`, `Math.random()`,
 * `performance.now()`, `crypto.randomUUID()`, `crypto.getRandomValues()`, and
 * `new Date()` / `Date()` without arguments.
 */
export function isNondeterministicCall(context: Context, node: ESTree.Node): boolean {
  if (
    isGlobalMemberCall(context, node, "Date", "now") ||
    isGlobalMemberCall(context, node, "Math", "random") ||
    isGlobalMemberCall(context, node, "performance", "now") ||
    isGlobalMemberCall(context, node, "crypto", "randomUUID") ||
    isGlobalMemberCall(context, node, "crypto", "getRandomValues")
  )
    return true;
  if ((node.type === "NewExpression" || node.type === "CallExpression") && node.arguments.length === 0) {
    const callee = unwrapExpression(node.callee);
    return callee.type === "Identifier" && callee.name === "Date" && !isShadowed(context, callee, "Date");
  }
  return false;
}
