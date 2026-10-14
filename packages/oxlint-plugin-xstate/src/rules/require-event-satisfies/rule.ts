/**
 * Require object-literal events to be checked with `satisfies` when sent.
 *
 * Recognized senders: `raise` / `sendTo` / `sendParent` / `emit` from `xstate`
 * and on the `enqueueActions` enqueue object (XState v5); `enq.raise` /
 * `enq.sendTo` / `enq.emit` / `enq.sendBack` on the handler enqueuer (XState
 * v6); `send(actor, event)` and `send(event)` from `@xstate/effect`; `.send` on
 * actor refs; and the `send` slot of the `useMachine` / `useActor` tuple.
 *
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import { isEnqueuerParameter } from "../ast.js";
import { effectImportedName, importedName, isActor, isEnqueueParameter, isTupleSend } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message = "Sent object events must be checked with satisfies against the machine's event type.";

type RuleOptions = { readonly sendCalleeNames?: readonly string[] };

type Sender = { readonly name: string; readonly eventIndex: number };

const defaultSendCalleeNames = ["send", "raise", "sendTo", "sendParent", "emit", "sendBack"] as const;

const enqueueSenders: ReadonlySet<string> = new Set(["raise", "sendTo", "sendParent", "emit"]);

const enqueuerSenders: ReadonlySet<string> = new Set(["raise", "sendTo", "emit", "sendBack"]);

function sendCalleeNames(context: unknown): readonly string[] {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const names = (first as RuleOptions).sendCalleeNames;
    if (Array.isArray(names) && names.every((name) => typeof name === "string")) return names;
  }
  return defaultSendCalleeNames;
}

function calleeName(callee: ESTree.Expression | ESTree.Super): string | undefined {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
    return callee.property.name;
  }
  return undefined;
}

/** `sendTo(target, event)` carries the event second; every other sender carries it first. */
function byName(name: string | undefined): Sender | undefined {
  return name === undefined ? undefined : { name, eventIndex: name === "sendTo" ? 1 : 0 };
}

function resolvedSender(context: Context, call: ESTree.CallExpression): Sender | undefined {
  const callee = call.callee;
  const imported = importedName(context, callee);
  if (imported !== undefined) return byName(imported);
  if (effectImportedName(context, callee) === "send")
    return { name: "send", eventIndex: call.arguments.length > 1 ? 1 : 0 };
  if (callee.type === "Identifier") return isTupleSend(context, callee) ? byName("send") : undefined;
  const name = calleeName(callee);
  if (name === undefined || callee.type !== "MemberExpression") return undefined;
  if (name === "send") return isActor(context, callee.object) ? byName(name) : undefined;
  if (enqueueSenders.has(name) && isEnqueueParameter(context, callee.object)) return byName(name);
  return enqueuerSenders.has(name) && isEnqueuerParameter(context, callee.object) ? byName(name) : undefined;
}

function isBareTypedObjectEvent(
  argument: ESTree.Expression | ESTree.SpreadElement | undefined,
): argument is ESTree.ObjectExpression {
  if (argument === undefined || argument.type !== "ObjectExpression") return false;
  return argument.properties.some((property) => {
    if (property.type !== "Property" || property.computed) return false;
    const key = property.key;
    return (key.type === "Identifier" && key.name === "type") || (key.type === "Literal" && key.value === "type");
  });
}

export const requireEventSatisfies: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require object-literal events sent to machines to be checked with satisfies.",
    },
    messages: {
      requireEventSatisfies: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          sendCalleeNames: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const configured = context.options[0] !== undefined;
        const sender = configured ? byName(calleeName(node.callee)) : resolvedSender(context, node);
        if (sender === undefined || !sendCalleeNames(context).includes(sender.name)) return;
        let eventArgument = node.arguments[sender.eventIndex];
        while (eventArgument?.type === "TSAsExpression" || eventArgument?.type === "TSTypeAssertion")
          eventArgument = eventArgument.expression;
        if (
          eventArgument?.type === "TSSatisfiesExpression" &&
          (eventArgument.typeAnnotation.type === "TSUnknownKeyword" ||
            eventArgument.typeAnnotation.type === "TSAnyKeyword")
        )
          eventArgument = eventArgument.expression;
        if (!isBareTypedObjectEvent(eventArgument)) return;
        context.report({ node: eventArgument, messageId: "requireEventSatisfies" });
      },
    };
  },
};
