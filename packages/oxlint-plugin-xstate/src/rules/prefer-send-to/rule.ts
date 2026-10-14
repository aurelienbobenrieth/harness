/**
 * Prefer `sendTo` with an explicit actor ref over `sendParent`.
 *
 * @deprecated XState v6 removes `sendParent`: handlers reach the parent through `({ parent }, enq) =>
 * enq.sendTo(parent, event)`. It keeps working on XState v5 code.
 */
import { memberPropertyName } from "@aurelienbbn/oxlint-kit/ast";
import { importsFrom } from "../ast.js";
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
    deprecated: {
      message:
        "XState v6 removes sendParent (use ({ parent }, enq) => enq.sendTo(parent, event)); this rule keeps working on XState v5 code and has no replacement.",
      deprecatedSince: "0.2.0",
    },
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
