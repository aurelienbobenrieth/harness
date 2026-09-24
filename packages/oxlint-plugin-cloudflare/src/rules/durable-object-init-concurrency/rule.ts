/**
 * Require async Durable Object constructor work to run inside
 * `ctx.blockConcurrencyWhile()`, and keep network I/O out of that callback.
 *
 * @attribution https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ (inspiration; independently implemented)
 */
import {
  enclosingClass,
  extendsWorkersClass,
  isFunctionNode,
  isShadowed,
  memberPropertyName,
  methodOf,
  parentOf,
  propertyKeyName,
  unwrapExpression,
  walk,
} from "../ast.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const unguardedMessage =
  "This async work starts in the Durable Object constructor without blocking input, so requests can run against half-initialised state. Wrap it in `ctx.blockConcurrencyWhile(async () => { ... })`.";

const networkMessage =
  "Network I/O inside blockConcurrencyWhile() holds the object's input gate across a remote round trip, stalling every request to this object. Keep only storage reads and schema setup in the callback; move fetches and binding calls out.";

/** Async storage methods on `ctx.storage` (the synchronous `storage.kv` and `storage.sql` are excluded by receiver). */
const asyncStorageMethods: ReadonlySet<string> = new Set([
  "get",
  "put",
  "list",
  "delete",
  "deleteAll",
  "transaction",
  "getAlarm",
  "setAlarm",
  "deleteAlarm",
  "sync",
]);

function isBlockConcurrencyWhile(node: ESTree.Node): boolean {
  return (
    node.type === "CallExpression" && memberPropertyName(unwrapExpression(node.callee)) === "blockConcurrencyWhile"
  );
}

function isGlobalFetch(context: Context, node: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(node.callee);
  return callee.type === "Identifier" && callee.name === "fetch" && !isShadowed(context, callee, "fetch");
}

/** `<x>.storage.get(...)` and the other promise-returning storage methods. */
function isAsyncStorageCall(node: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression") return false;
  const method = memberPropertyName(callee);
  if (method === undefined || !asyncStorageMethods.has(method)) return false;
  const owner = unwrapExpression(callee.object);
  return (owner.type === "Identifier" && owner.name === "storage") || memberPropertyName(owner) === "storage";
}

/** Binding methods that reach another service: KV, R2, D1, Queues, service bindings, and stubs. */
const bindingIoMethods: ReadonlySet<string> = new Set([
  "get",
  "getWithMetadata",
  "put",
  "list",
  "delete",
  "head",
  "fetch",
  "connect",
  "send",
  "sendBatch",
  "prepare",
  "batch",
  "exec",
  "dump",
]);

/** A binding I/O call rooted at `env`: `env.KV.get(...)`, `this.env.SERVICE.fetch(...)`, `env.DB.prepare(...)`. */
function isBindingCall(node: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression") return false;
  const method = memberPropertyName(callee);
  if (method === undefined || !bindingIoMethods.has(method)) return false;
  let current = unwrapExpression(callee.object);
  while (current.type === "MemberExpression") {
    const owner = unwrapExpression(current.object);
    if ((owner.type === "Identifier" && owner.name === "env") || memberPropertyName(owner) === "env") return true;
    current = owner;
  }
  return false;
}

/** Names of `async` methods declared on the class, so `this.init()` counts as async work. */
function asyncMethodNames(owner: ESTree.Class): ReadonlySet<string> {
  const names = new Set<string>();
  for (const member of owner.body.body) {
    if (member.type !== "MethodDefinition" || member.kind !== "method" || !member.value.async) continue;
    const name = propertyKeyName(member);
    if (name !== undefined) names.add(name);
  }
  return names;
}

function isAsyncWork(context: Context, node: ESTree.Node, asyncMethods: ReadonlySet<string>): boolean {
  if (node.type !== "CallExpression") return false;
  if (isGlobalFetch(context, node) || isAsyncStorageCall(node)) return true;
  const callee = unwrapExpression(node.callee);
  if (isFunctionNode(callee) && callee.async === true) return true;
  if (callee.type !== "MemberExpression" || unwrapExpression(callee.object).type !== "ThisExpression") return false;
  const name = memberPropertyName(callee);
  return name !== undefined && asyncMethods.has(name);
}

function isDurableObjectConstructor(context: Context, fn: ESTree.Node): ESTree.Class | undefined {
  const method = methodOf(fn);
  if (method?.kind !== "constructor") return undefined;
  const owner = enclosingClass(method);
  return owner !== undefined && extendsWorkersClass(context, owner, ["DurableObject"]) ? owner : undefined;
}

export const durableObjectInitConcurrency: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require async work in a DurableObject constructor (storage reads, fetch, async methods or IIFEs) to run inside ctx.blockConcurrencyWhile(), and forbid fetch or binding calls inside a blockConcurrencyWhile() callback.",
    },
    messages: {
      unguardedAsyncInit: unguardedMessage,
      networkInBlockConcurrency: networkMessage,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      FunctionExpression(node) {
        const owner = isDurableObjectConstructor(context, node);
        if (owner === undefined || node.body === null) return;
        const asyncMethods = asyncMethodNames(owner);
        walk(node.body, (child) => {
          // Callbacks (including the blockConcurrencyWhile argument) run later or under the input gate.
          if (child !== node.body && isFunctionNode(child) && !isImmediatelyInvoked(child)) return false;
          if (!isAsyncWork(context, child, asyncMethods)) return undefined;
          context.report({ node: child, messageId: "unguardedAsyncInit" });
          return false;
        });
      },
      CallExpression(node) {
        if (!isBlockConcurrencyWhile(node)) return;
        for (const argument of node.arguments) {
          if (!isFunctionNode(argument) || argument.body === null) continue;
          walk(argument.body, (child) => {
            if (child.type !== "CallExpression") return undefined;
            if (!isGlobalFetch(context, child) && !isBindingCall(child)) return undefined;
            context.report({ node: child, messageId: "networkInBlockConcurrency" });
            return false;
          });
        }
      },
    };
  },
};

function isImmediatelyInvoked(fn: ESTree.Node): boolean {
  let child: ESTree.Node = fn;
  let parent = parentOf(fn);
  while (parent !== undefined && unwrapExpression(parent) !== parent) {
    child = parent;
    parent = parentOf(parent);
  }
  return parent?.type === "CallExpression" && parent.callee === child;
}
