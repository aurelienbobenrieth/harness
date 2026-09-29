/**
 * @attribution eslint-plugin-unicorn `no-array-sort` (MIT; rule concept, independently re-implemented)
 */
import type { Rule } from "@oxlint/plugins";
import { effectModuleOf } from "../binding-support.js";

const message =
  "Use `toSorted()`: `sort()` reorders the array in place. Effect's `Arr.sort` returns a new array and is allowed.";

export const noArraySort: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow Array#sort, which mutates, in favor of toSorted, skipping Effect's sort helpers (`Arr.sort`), which do not.",
    },
    messages: { noArraySort: message },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier" || callee.property.name !== "sort") return;
        if (effectModuleOf(context, callee.object) !== undefined) return;

        context.report({ node: callee.property, messageId: "noArraySort" });
      },
    };
  },
};
