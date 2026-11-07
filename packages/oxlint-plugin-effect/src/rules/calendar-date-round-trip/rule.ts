import type { ESTree, Rule } from "@oxlint/plugins";
import { moduleMethod } from "../binding-support.js";

/** Follow the enclosing fluent schema expression, without trusting checks elsewhere in the file. */
function chain(node: ESTree.Node): ESTree.Node {
  let top = node;
  while (top.parent?.type === "CallExpression" || top.parent?.type === "MemberExpression") top = top.parent;
  return top;
}

export const calendarDateRoundTrip: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Pair a YYYY-MM-DD Effect Schema pattern with an explicit calendar-date refinement.",
    },
    messages: {
      calendar:
        "This regex only checks date shape. Add a calendar round-trip refinement; reject 2026-02-31 and accept 2024-02-29 in its tests.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!["pattern", "isPattern"].includes(moduleMethod(context, node.callee, "Schema") ?? "")) return;
        const argument = node.arguments[0];
        if (argument?.type !== "Literal" || !("regex" in argument)) return;
        if (argument.regex.pattern !== "^\\d{4}-\\d{2}-\\d{2}$") return;
        const top = chain(node);
        const text = context.sourceCode.getText(top).replace(context.sourceCode.getText(node), "");
        if (/\b(?:filter|check)\s*\(\s*[^)\s]/.test(text)) return;
        context.report({ node, messageId: "calendar" });
      },
    };
  },
};
