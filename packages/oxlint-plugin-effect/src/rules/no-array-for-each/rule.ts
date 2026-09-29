/**
 * @attribution eslint-plugin-unicorn `no-array-for-each` (MIT; rule concept, independently re-implemented)
 */
import type { Rule } from "@oxlint/plugins";
import { effectModuleOf } from "../binding-support.js";

const message =
  "Use `for…of` instead of `.forEach`: it can break, await and narrow. Effect's `forEach` helpers are not arrays and are allowed.";

export const noArrayForEach: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow Array#forEach in favor of for…of, skipping Effect's forEach helpers (`Effect.forEach`).",
    },
    messages: { noArrayForEach: message },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier" || callee.property.name !== "forEach") return;
        if (effectModuleOf(context, callee.object) !== undefined) return;

        context.report({ node: callee.property, messageId: "noArrayForEach" });
      },
    };
  },
};
