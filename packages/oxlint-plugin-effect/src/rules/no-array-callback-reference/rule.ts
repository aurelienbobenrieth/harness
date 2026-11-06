/**
 * @attribution eslint-plugin-unicorn `no-array-callback-reference` (MIT; rule concept, independently re-implemented)
 */
import { binding } from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree, Rule } from "@oxlint/plugins";
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

/** Global conversion functions that read their first argument only: `ids.map(Number)` cannot leak the index. */
const unaryGlobals: ReadonlySet<string> = new Set(["BigInt", "Boolean", "Number", "String"]);

/** Reducers receive the accumulator before the value; every other method passes the value, then the index. */
const reducers: ReadonlySet<string> = new Set(["reduce", "reduceRight"]);

function declaredFunction(
  context: Context,
  node: ESTree.Node & { readonly name: string },
): ESTree.Function | ESTree.ArrowFunctionExpression | undefined {
  const variable = binding(context, node, node.name);
  for (const definition of variable?.defs ?? []) {
    const declaration = definition.node;
    if (declaration.type === "FunctionDeclaration") return declaration;
    if (declaration.type !== "VariableDeclarator" || declaration.init === null) continue;
    const init = declaration.init;
    if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") return init;
  }
  return undefined;
}

/**
 * Whether the reference can only receive the arguments it reads: a global conversion function, or a function declared
 * in this file with no parameter for the index (the second, or for reducers the third, argument).
 */
function ignoresExtraArguments(context: Context, node: ESTree.Node, method: string): boolean {
  if (node.type !== "Identifier") return false;
  const variable = binding(context, node, node.name);
  if (variable === undefined || variable.defs.length === 0) return unaryGlobals.has(node.name);
  const callback = declaredFunction(context, node);
  if (callback === undefined || callback.params.some((parameter) => parameter.type === "RestElement")) return false;
  return callback.params.length <= (reducers.has(method) ? 2 : 1);
}

function isFunctionReference(context: Context, node: ESTree.Node | undefined, method: string): boolean {
  if (node?.type === "MemberExpression") return true;

  // `filter(Boolean)` is the idiomatic truthiness filter; Boolean ignores the extra arguments.
  return node?.type === "Identifier" && node.name !== "Boolean" && !ignoresExtraArguments(context, node, method);
}

export const noArrayCallbackReference: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing a function reference to an array method's callback unless it ignores the index, skipping calls on Effect modules that are not arrays.",
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
        if (!isFunctionReference(context, callback, callee.property.name)) return;

        context.report({ node: callback ?? node, messageId: "noArrayCallbackReference" });
      },
    };
  },
};
