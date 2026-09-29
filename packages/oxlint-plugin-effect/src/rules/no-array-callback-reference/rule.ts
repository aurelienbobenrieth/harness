/**
 * @attribution eslint-plugin-unicorn `no-array-callback-reference` (MIT; rule concept, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { effectModuleOf } from "../binding-support.js";

const message =
  "Pass an inline callback, not a function reference: array methods call it with the index and the array too (`['1', '2'].map(parseInt)`).";

const callbackMethods: ReadonlySet<string> = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
]);

/** Effect's array helpers pass the index like native methods do; its other modules (`Option.some`, `Option.filter`) do not. */
const indexPassingModules: ReadonlySet<string> = new Set(["effect/Array"]);

function isFunctionReference(node: ESTree.Node | undefined): boolean {
  if (node?.type === "MemberExpression") return true;
  // `filter(Boolean)` is the idiomatic truthiness filter; Boolean ignores the extra arguments.
  return node?.type === "Identifier" && node.name !== "Boolean";
}

export const noArrayCallbackReference: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing a function reference to an array method's callback, skipping calls on Effect modules that are not arrays.",
    },
    messages: { noArrayCallbackReference: message },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier" || !callbackMethods.has(callee.property.name)) return;

        const module = effectModuleOf(context, callee.object);
        if (module !== undefined && !indexPassingModules.has(module)) return;
        // Effect's dual helpers take the callback last (`Arr.map(xs, f)`, `Arr.map(f)`); native methods take it first.
        const callback = module === undefined ? node.arguments[0] : node.arguments.at(-1);
        if (!isFunctionReference(callback)) return;

        context.report({ node: callback ?? node, messageId: "noArrayCallbackReference" });
      },
    };
  },
};
