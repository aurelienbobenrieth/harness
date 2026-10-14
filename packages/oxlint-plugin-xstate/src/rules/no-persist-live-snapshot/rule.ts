/**
 * Forbid serializing an actor's live snapshot with `JSON.stringify` instead of
 * its persisted snapshot.
 */
import {
  binding,
  isFunctionNode,
  memberPropertyName,
  parentOf,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import { isActor } from "../binding-support.js";
import { boundInitializer, reactIntegrationImport, xstateImport } from "../v6-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "JSON.stringify of a live snapshot keeps runtime-only state and drops what restore needs (child actor state; in v6 also the machine id and version), so restoring it fails or loses state. Serialize actor.getPersistedSnapshot() instead.";

/** An actor ref: one `isActor` recognises, or `createActor(...)` / `createActor(...).start()` inline or bound. */
function isLiveActor(context: Context, node: ESTree.Node): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (isActor(context, value)) return true;
  const expression = value.type === "Identifier" ? boundInitializer(context, value) : value;
  if (expression === undefined) return false;
  let call = unwrapExpressionKeepingChain(expression);
  if (
    call.type === "CallExpression" &&
    call.callee.type === "MemberExpression" &&
    memberPropertyName(call.callee) === "start"
  )
    call = unwrapExpressionKeepingChain(call.callee.object);
  return call.type === "CallExpression" && xstateImport(context, call.callee) === "createActor";
}

/** `<actor>.getSnapshot()` on a provable actor ref. */
function isGetSnapshotCall(context: Context, node: ESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    memberPropertyName(node.callee) === "getSnapshot" &&
    isLiveActor(context, node.callee.object)
  );
}

/** First slot of a `useMachine(...)` / `useActor(...)` tuple from `@xstate/react`. */
function isHookSnapshot(context: Context, node: ESTree.Node & { readonly name: string }): boolean {
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator" || declarator.id.type !== "ArrayPattern") return false;
    if (declarator.id.elements[0] !== definition.name) return false;
    const initial = declarator.init;
    if (initial?.type !== "CallExpression") return false;
    const hook = reactIntegrationImport(context, initial.callee);
    return hook === "useMachine" || hook === "useActor";
  });
}

/** First parameter of a listener passed straight to `<actor>.subscribe(listener)`. */
function isSubscribedSnapshot(context: Context, node: ESTree.Node & { readonly name: string }): boolean {
  return (binding(context, node, node.name)?.defs ?? []).some((definition) => {
    const listener = definition.node;
    if (definition.type !== "Parameter" || !isFunctionNode(listener) || listener.params[0] !== definition.name)
      return false;
    const call = parentOf(listener);
    return (
      call?.type === "CallExpression" &&
      call.arguments[0] === listener &&
      call.callee.type === "MemberExpression" &&
      memberPropertyName(call.callee) === "subscribe" &&
      isLiveActor(context, call.callee.object)
    );
  });
}

function isLiveSnapshot(context: Context, node: ESTree.Node): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (isGetSnapshotCall(context, value)) return true;
  if (value.type !== "Identifier") return false;
  const initial = boundInitializer(context, value);
  if (initial !== undefined) return isGetSnapshotCall(context, unwrapExpressionKeepingChain(initial));
  return isHookSnapshot(context, value) || isSubscribedSnapshot(context, value);
}

function isJsonStringify(context: Context, callee: ESTree.Node): boolean {
  if (memberPropertyName(callee) !== "stringify" || callee.type !== "MemberExpression") return false;
  const host = callee.object;
  if (host.type !== "Identifier" || host.name !== "JSON") return false;
  const variable = binding(context, host, "JSON");
  return variable === undefined || variable.defs.length === 0;
}

export const noPersistLiveSnapshot: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid JSON.stringify of an actor's live snapshot (getSnapshot(), a useMachine snapshot, a subscribe listener's snapshot) instead of getPersistedSnapshot().",
    },
    messages: {
      noPersistLiveSnapshot: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isJsonStringify(context, node.callee)) return;
        const serialized = node.arguments[0];
        if (serialized === undefined || serialized.type === "SpreadElement") return;
        if (!isLiveSnapshot(context, serialized)) return;
        context.report({ node, messageId: "noPersistLiveSnapshot" });
      },
    };
  },
};
