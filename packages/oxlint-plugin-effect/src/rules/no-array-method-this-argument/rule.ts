/**
 * @attribution eslint-plugin-unicorn `no-array-method-this-argument` (MIT; rule concept, independently re-implemented)
 */
import type { Rule } from "@oxlint/plugins";
import { effectModuleOf } from "../binding-support.js";

const message =
  "Bind the callback instead of passing `thisArg`: an arrow function or `.bind` says what `this` is where it is used.";

const thisArgumentMethods: ReadonlySet<string> = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "map",
  "some",
]);

/** A native array method takes its callback, then `thisArg`: a second argument. */
const THIS_ARGUMENT_POSITION = 2;

export const noArrayMethodThisArgument: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow the `thisArg` of array methods, skipping Effect's data-first helpers (`Arr.filter(xs, f)`), whose second argument is the callback.",
    },
    messages: { noArrayMethodThisArgument: message },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier" || !thisArgumentMethods.has(callee.property.name)) return;
        if (node.arguments.length !== THIS_ARGUMENT_POSITION) return;
        if (effectModuleOf(context, callee.object) !== undefined) return;

        context.report({ node: node.arguments.at(-1) ?? node, messageId: "noArrayMethodThisArgument" });
      },
    };
  },
};
