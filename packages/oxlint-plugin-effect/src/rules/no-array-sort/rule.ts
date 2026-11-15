/**
 * @attribution eslint-plugin-unicorn `no-array-sort` (MIT; rule concept, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { effectModuleOf } from "../binding-support.js";

const message =
  "Use `toSorted()`: `sort()` reorders the array in place. Effect's `Arr.sort` returns a new array and is allowed.";

/** An array comparator is a function (or omitted); a literal, template or object argument is a query builder's sort spec. */
function isComparatorArgument(node: ESTree.Node | undefined): boolean {
  return (
    node === undefined ||
    (node.type !== "Literal" &&
      node.type !== "ObjectExpression" &&
      node.type !== "ArrayExpression" &&
      node.type !== "TemplateLiteral")
  );
}

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
        if (node.arguments.length > 1 || !isComparatorArgument(node.arguments[0])) return;

        context.report({ node: callee.property, messageId: "noArraySort" });
      },
    };
  },
};
