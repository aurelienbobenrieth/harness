/**
 * Recognition of XState v6 and `@xstate/effect` shapes shared by the v6 rules:
 * machine factories, the config argument of a config host, handler functions
 * and their `enq` parameter, and Effect-constructing expressions.
 *
 * Every match starts from a binding imported from `xstate`, `@xstate/effect`,
 * or `effect`; a lookalike defined locally never matches.
 *
 * @module
 */
import {
  type FunctionNode,
  binding,
  importedSpecifierName,
  isFunctionNode,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";

/** Exported name of an identifier or namespace member imported from `xstate`. */
export function xstateImport(context: Context, node: ESTree.Node): string | undefined {
  return importedSpecifierName(context, node, (source) => source === "xstate");
}

/** Exported name of an identifier or namespace member imported from `@xstate/effect`. */
export function effectIntegrationImport(context: Context, node: ESTree.Node): string | undefined {
  return importedSpecifierName(context, node, (source) => source === "@xstate/effect");
}

/** Exported name of an identifier or namespace member imported from `@xstate/react`. */
export function reactIntegrationImport(context: Context, node: ESTree.Node): string | undefined {
  return importedSpecifierName(context, node, (source) => source === "@xstate/react");
}

const maxBindingDepth = 8;

/** Initializer of the variable an identifier is declared with (`const x = <init>`), if it has exactly one. */
export function boundInitializer(context: Context, node: ESTree.Node): ESTree.Node | undefined {
  if (node.type !== "Identifier") return undefined;
  const definitions = binding(context, node, node.name)?.defs ?? [];
  if (definitions.length !== 1) return undefined;
  const declarator = definitions[0]?.node;
  if (declarator?.type !== "VariableDeclarator" || declarator.id.type !== "Identifier") return undefined;
  return declarator.init ?? undefined;
}

function isSystem(context: Context, node: ESTree.Node, depth: number): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (value.type === "CallExpression") return xstateImport(context, value.callee) === "createSystem";
  const initial = depth < maxBindingDepth ? boundInitializer(context, value) : undefined;
  return initial !== undefined && isSystem(context, initial, depth + 1);
}

/**
 * True for a machine factory: `setup(...)` from `xstate`, `setupEffect(...)`
 * from `@xstate/effect`, `<system>.setup(...)` on a `createSystem(...)` result,
 * a chained `.extend(...)` of any of them, or a variable initialised by one.
 */
function isMachineFactory(context: Context, node: ESTree.Node, depth = 0): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (value.type === "CallExpression") {
    if (xstateImport(context, value.callee) === "setup") return true;
    if (effectIntegrationImport(context, value.callee) === "setupEffect") return true;
    if (value.callee.type !== "MemberExpression") return false;
    const method = memberPropertyName(value.callee);
    if (method === "extend") return isMachineFactory(context, value.callee.object, depth);
    return method === "setup" && isSystem(context, value.callee.object, depth);
  }
  const initial = depth < maxBindingDepth ? boundInitializer(context, value) : undefined;
  return initial !== undefined && isMachineFactory(context, initial, depth + 1);
}

/**
 * The argument of `call` that holds machine or state config, when `call` is a
 * config host: `createMachine(config)` / `createStateConfig(config)` from
 * `xstate`, or `<factory>.createMachine(config)`, `<factory>.createInvoke(config)`,
 * `<factory>.createStateConfig(config)` and `<factory>.createStateConfig(path, config)`.
 */
function configArgument(context: Context, call: ESTree.CallExpression): ESTree.Node | undefined {
  const imported = xstateImport(context, call.callee);
  if (imported === "createMachine" || imported === "createStateConfig") return call.arguments[0];
  if (call.callee.type !== "MemberExpression") return undefined;
  const method = memberPropertyName(call.callee);
  if (method !== "createMachine" && method !== "createInvoke" && method !== "createStateConfig") return undefined;
  if (!isMachineFactory(context, call.callee.object)) return undefined;
  return method === "createStateConfig" && call.arguments.length >= 2 ? call.arguments[1] : call.arguments[0];
}

const configShapeTypes: ReadonlySet<string> = new Set([
  "ArrayExpression",
  "ObjectExpression",
  "ParenthesizedExpression",
  "Property",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

/**
 * True when `node` sits inside the config argument of a config host, reached
 * only through object literals, arrays, properties, and type wrappers (never
 * through a function or another call).
 */
export function isInsideConfigArgument(context: Context, node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined) {
    if (current.type === "CallExpression") return configArgument(context, current) === child;
    if (!configShapeTypes.has(current.type)) return false;
    child = current;
    current = parentOf(current);
  }
  return false;
}

/** Keys whose function value is a handler called as `(args, enq)`. */
const handlerKeys: ReadonlySet<string> = new Set([
  "always",
  "entry",
  "exit",
  "onDone",
  "onError",
  "onSnapshot",
  "onTimeout",
  "to",
]);

/** Keys whose object value maps names to handlers (`on: { EVENT: fn }`, `after: { 1000: fn }`). */
const handlerMapKeys: ReadonlySet<string> = new Set(["after", "on"]);

/** Keys whose object value holds implementations or data, never handlers, whatever their member names. */
const sourceMapKeys: ReadonlySet<string> = new Set([
  "actions",
  "actors",
  "context",
  "delays",
  "guards",
  "input",
  "meta",
  "output",
  "schemas",
]);

function holderKey(objectNode: ESTree.Node | undefined): string | undefined {
  if (objectNode?.type !== "ObjectExpression") return undefined;
  const holder = parentOf(objectNode);
  return holder?.type === "Property" && holder.value === objectNode ? propertyKeyName(holder) : undefined;
}

/**
 * True for a v6 handler: a function in a handler position (`entry`, `exit`,
 * `always`, `onDone`, `onError`, `onSnapshot`, `onTimeout`, `to`, or a member of
 * `on` / `after`) of a config host's argument. Handlers receive `(args, enq)`.
 */
export function isConfigHandler(context: Context, fn: ESTree.Node): fn is FunctionNode {
  if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression") return false;
  const property = parentOf(fn);
  if (property?.type !== "Property" || property.value !== fn) return false;
  const key = propertyKeyName(property);
  const container = parentOf(property);
  const containerKey = holderKey(container);
  if (containerKey !== undefined && sourceMapKeys.has(containerKey)) return false;
  const inHandlerSlot =
    (key !== undefined && handlerKeys.has(key)) || (containerKey !== undefined && handlerMapKeys.has(containerKey));
  return inHandlerSlot && isInsideConfigArgument(context, property);
}

/**
 * The handler whose `enq` parameter (second positional parameter) `node` refers
 * to, if `node` is such a reference.
 */
export function enqueueHandler(context: Context, node: ESTree.Node): FunctionNode | undefined {
  if (node.type !== "Identifier") return undefined;
  const definitions = binding(context, node, node.name)?.defs ?? [];
  for (const definition of definitions) {
    if (definition.type !== "Parameter") continue;
    const fn = definition.node;
    if (!isFunctionNode(fn) || fn.params[1] !== definition.name) continue;
    if (isConfigHandler(context, fn)) return fn;
  }
  return undefined;
}

/** The identifier an `enq(...)` or `enq.<method>(...)` call is made through, if the callee has that shape. */
export function enqueueCallTarget(call: ESTree.CallExpression): ESTree.Node | undefined {
  const callee = unwrapExpressionKeepingChain(call.callee);
  if (callee.type === "Identifier") return callee;
  if (callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier")
    return callee.object;
  return undefined;
}

function isEffectNamespace(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  if (importedSpecifierName(context, node, (source) => source === "effect") === "Effect") return true;
  return (binding(context, node, node.name)?.defs ?? []).some(
    (definition) =>
      definition.node.type === "ImportNamespaceSpecifier" &&
      definition.parent?.type === "ImportDeclaration" &&
      definition.parent.source.value === "effect/Effect",
  );
}

/** `Effect.run*` executes an Effect and `Effect.is*` tests a value: neither builds an Effect. */
const nonConstructingMember = /^(?:run|is)[A-Z]/;

/**
 * True for an expression that builds an Effect: a member or call chain rooted at
 * the `Effect` namespace from `effect` (`Effect.log(...)`, `Effect.void`,
 * `Effect.gen(...).pipe(...)`), excluding runners and predicates and a chain
 * that pipes into a runner.
 */
export function isEffectExpression(context: Context, node: ESTree.Node): boolean {
  let current = unwrapExpressionKeepingChain(node);
  let firstMember: string | undefined;
  for (;;) {
    if (current.type === "CallExpression") {
      if (memberPropertyName(current.callee) === "pipe") {
        const last = current.arguments.at(-1);
        const lastName = last === undefined ? undefined : memberPropertyName(last);
        if (lastName !== undefined && nonConstructingMember.test(lastName)) return false;
      }
      current = unwrapExpressionKeepingChain(current.callee);
      continue;
    }
    if (current.type === "MemberExpression") {
      firstMember = memberPropertyName(current);
      current = unwrapExpressionKeepingChain(current.object);
      continue;
    }
    break;
  }
  if (firstMember === undefined || nonConstructingMember.test(firstMember)) return false;
  return isEffectNamespace(context, current);
}
