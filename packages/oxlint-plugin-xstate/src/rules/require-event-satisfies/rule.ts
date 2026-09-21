import { importedName, isActor, isEnqueueParameter, isTupleSend } from "../binding-support.js";
/**
 * Require object-literal events to be checked with `satisfies` when sent.
 *
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message = "Sent object events must be checked with satisfies against the machine's event type.";

type RuleOptions = { readonly sendCalleeNames?: readonly string[] };

const defaultSendCalleeNames = ["send", "raise", "sendTo", "sendParent", "emit"] as const;

const enqueueSenders: ReadonlySet<string> = new Set(["raise", "sendTo", "sendParent", "emit"]);

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

function resolvedSenderName(context: Context, callee: ESTree.Expression | ESTree.Super): string | undefined {
  const imported = importedName(context, callee);
  if (imported !== undefined) return imported;
  if (callee.type === "Identifier") return isTupleSend(context, callee) ? "send" : undefined;
  const name = calleeName(callee);
  if (name === undefined || callee.type !== "MemberExpression") return undefined;
  if (name === "send") return isActor(context, callee.object) ? name : undefined;
  return enqueueSenders.has(name) && isEnqueueParameter(context, callee.object) ? name : undefined;
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
        const name = configured ? calleeName(node.callee) : resolvedSenderName(context, node.callee);
        if (name === undefined || !sendCalleeNames(context).includes(name)) return;
        let eventArgument = node.arguments[name === "sendTo" ? 1 : 0];
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
