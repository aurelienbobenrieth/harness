/**
 * Prefer `sendTo` with an explicit actor ref over `sendParent`.
 */
import { importsFrom, memberPropertyName } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { Rule } from "@oxlint/plugins";

const message =
  "sendParent() couples the child to an untyped parent and breaks when the actor runs as a root: pass the parent ref through input and use sendTo(({ context }) => context.parentRef, event).";

export const preferSendTo: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer sendTo() with an actor ref passed through input over sendParent() and enqueue.sendParent().",
    },
    messages: {
      preferSendTo: message,
    },
    schema: [],
  },
  createOnce(context) {
    let enabled = false;
    return {
      Program(node) {
        enabled = importsFrom(node, ["xstate"]);
      },
      ImportSpecifier(node) {
        if (importedName(context, node.local) !== "sendParent") return;
        context.report({ node, messageId: "preferSendTo" });
      },
      CallExpression(node) {
        if (!enabled || node.callee.type !== "MemberExpression") return;
        if (memberPropertyName(node.callee) !== "sendParent" || node.callee.object.type !== "Identifier") return;
        context.report({ node, messageId: "preferSendTo" });
      },
    };
  },
};
