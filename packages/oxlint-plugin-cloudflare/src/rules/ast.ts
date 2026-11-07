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

const workerOnlyHandlers: ReadonlySet<string> = new Set(["scheduled", "queue", "email", "tail", "trace"]);

/** Configuration keys of `Bun.serve` / `Deno.serve` style default exports, which are not Worker handler objects. */
const otherRuntimeKeys: ReadonlySet<string> = new Set([
  "port",
  "hostname",
  "websocket",
  "tls",
  "development",
  "routes",
  "idleTimeout",
  "reusePort",
  "unix",
]);

function isFunctionValue(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  return value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression";
}

/**
 * The Worker `fetch(request, env, ctx)` signature: a function taking an `env` (or further) parameter that is not
 * the `server` handle of Bun and Deno, or a reference such as `app.fetch` handed over as the handler.
 */
function isWorkerFetch(value: ESTree.Node): boolean {
  const handler = unwrapExpression(value);
  if (handler.type !== "ArrowFunctionExpression" && handler.type !== "FunctionExpression") return true;
  const second = handler.params[1];
  if (second === undefined) return false;
  return !(second.type === "Identifier" && /^_?(server|info|connInfo)$/u.test(second.name));
}

function handlerProperty(node: ESTree.ObjectExpression, name: string): ESTree.ObjectProperty | undefined {
  for (const property of node.properties)
    if (property.type === "Property" && propertyKeyName(property) === name) return property;
  return undefined;
}

function isHandlerObject(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type !== "ObjectExpression") return false;
  const names = value.properties.flatMap((property) =>
    property.type === "Property" ? [propertyKeyName(property)] : [],
  );
  if (names.some((name) => name !== undefined && otherRuntimeKeys.has(name))) return false;
  if (
    names.some((name) => {
      if (name === undefined || !workerOnlyHandlers.has(name)) return false;
      const property = handlerProperty(value, name);
      return property !== undefined && isFunctionValue(property.value as ESTree.Node);
    })
  )
    return true;
  const fetch = handlerProperty(value, "fetch");
  return fetch !== undefined && isWorkerFetch(fetch.value as ESTree.Node);
}

/**
 * True for a Worker module: it imports `cloudflare:workers`, or its default
 * export is a Worker handler object, directly or through a module-level
 * binding. A handler object has a `scheduled` / `queue` / `email` / `tail` /
 * `trace` function, or a `fetch` that takes `env` or is passed by reference
 * (`fetch: app.fetch`). Bun and Deno serve configs (`port`, `websocket`, ...),
 * a one-parameter `fetch(request)` and a `fetch(request, server)` are not
 * recognised: other runtimes share that shape.
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
