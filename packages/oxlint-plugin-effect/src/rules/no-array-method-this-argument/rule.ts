/**
 * @attribution eslint-plugin-unicorn `no-array-method-this-argument` (MIT; rule concept, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
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

/** A `thisArg` follows a callback, so a first argument that cannot be a function means the receiver is not an array. */
function canBeCallback(node: ESTree.Node | undefined): boolean {
  return (
    node !== undefined &&
    node.type !== "Literal" &&
    node.type !== "ObjectExpression" &&
    node.type !== "ArrayExpression" &&
    node.type !== "TemplateLiteral"
  );
}

/** Arrays are never named like a namespace or class: `Output.map(value, f)` and `Query.find(Model, filter)` are not arrays. */
function isCapitalizedReceiver(node: ESTree.Node): boolean {
  return node.type === "Identifier" && /^[A-Z]/u.test(node.name);
}

export const noArrayMethodThisArgument: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow the `thisArg` of array methods, skipping Effect's data-first helpers (`Arr.filter(xs, f)`), capitalized receivers such as module namespaces, and calls whose first argument cannot be a callback.",
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
        if (isCapitalizedReceiver(callee.object) || !canBeCallback(node.arguments[0])) return;

        context.report({ node: node.arguments.at(-1) ?? node, messageId: "noArrayMethodThisArgument" });
      },
    };
  },
};
