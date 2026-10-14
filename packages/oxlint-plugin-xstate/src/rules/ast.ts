import {
  binding,
  isFunctionNode,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  stringLiteralValue,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";
import { effectImportedName, importedName, isSystemResult } from "./binding-support.js";

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
 * True for a call that starts a setup chain: `setup(...)` from `xstate`,
 * `setupEffect(...)` from `@xstate/effect`, or `<system>.setup(...)` on a
 * `createSystem()` result.
 */
export function isSetupCall(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "CallExpression") return false;
  if (importedName(context, node.callee) === "setup" || effectImportedName(context, node.callee) === "setupEffect")
    return true;
  return (
    node.callee.type === "MemberExpression" &&
    memberPropertyName(node.callee) === "setup" &&
    isSystemResult(context, node.callee.object)
  );
}

/**
 * True for a value produced by a setup call (see {@link isSetupCall}): the call
 * itself, a chained `.extend(...)`, or an identifier initialised by either.
 */
export function isSetupResult(context: Context, node: ESTree.Node): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (value.type === "CallExpression") {
    if (isSetupCall(context, value)) return true;
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

const configCalleeNames: ReadonlySet<string> = new Set(["createMachine", "createStateConfig"]);

/**
 * True for callees that take machine config: `createMachine` (and, in XState v6,
 * `createStateConfig`) imported from `xstate`, and `<setup>.createMachine` /
 * `<setup>.createStateConfig`.
 */
export function isMachineConfigCallee(context: Context, callee: ESTree.Node): boolean {
  const imported = importedName(context, callee);
  if (imported !== undefined && configCalleeNames.has(imported)) return true;
  const name = memberPropertyName(callee);
  return name !== undefined && configCalleeNames.has(name);
}

/**
 * The machine-config argument of a machine-config call: the first argument,
 * or the second for the XState v6 `createStateConfig(path, config)` overload.
 */
function machineConfigArgument(call: ESTree.CallExpression): ESTree.Node | undefined {
  const [first, second] = call.arguments;
  if (first === undefined) return undefined;
  return second !== undefined && stringLiteralValue(unwrapExpressionKeepingChain(first)) !== undefined ? second : first;
}

/** True when the node sits inside the config argument of a machine-config call. */
export function isInsideMachineConfig(context: Context, node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined) {
    if (
      current.type === "CallExpression" &&
      machineConfigArgument(current) === child &&
      isMachineConfigCallee(context, current.callee)
    )
      return true;
    child = current;
    current = parentOf(current);
  }
  return false;
}

const enqueuerLogicCreators: ReadonlySet<string> = new Set(["createLogic", "createAsyncLogic"]);

function hostsEnqueuerHandlers(context: Context, call: ESTree.CallExpression): boolean {
  if (isMachineConfigCallee(context, call.callee)) return true;
  const imported = importedName(context, call.callee);
  if (imported !== undefined) return enqueuerLogicCreators.has(imported);
  return (
    call.callee.type === "MemberExpression" &&
    memberPropertyName(call.callee) === "createInvoke" &&
    isSetupResult(context, call.callee.object)
  );
}

/**
 * True for a function written directly in the arguments of an XState v6 call
 * that passes an enqueuer as the second handler parameter: machine config,
 * `createLogic` / `createAsyncLogic` config, and `<setup>.createInvoke` config.
 * Crossing another function on the way up disqualifies it.
 */
function isHostedHandler(context: Context, fn: ESTree.Node): boolean {
  let child: ESTree.Node = fn;
  let current = parentOf(fn);
  while (current !== undefined) {
    if (isFunctionNode(current)) return false;
    if (current.type === "CallExpression")
      return current.arguments.includes(child as ESTree.Expression) && hostsEnqueuerHandlers(context, current);
    child = current;
    current = parentOf(current);
  }
  return false;
}

/**
 * True for the XState v6 enqueuer: an identifier bound to the second parameter
 * of a handler `(args, enq) => ...` written in machine config, in
 * `createLogic` / `createAsyncLogic` config, or in `<setup>.createInvoke` config.
 */
export function isEnqueuerParameter(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    if (definition.type !== "Parameter" || !isFunctionNode(definition.node)) return false;
    const second = definition.node.params[1];
    return second?.type === "Identifier" && second.name === node.name && isHostedHandler(context, definition.node);
  });
}
