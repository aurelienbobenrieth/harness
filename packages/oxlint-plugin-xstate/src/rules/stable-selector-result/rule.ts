/**
 * Forbid `useSelector` selectors that allocate a new object or array without a comparator.
 */
import { importsFrom, isFunctionNode, memberPropertyName, unwrapExpression } from "../ast.js";
import { importedNameFrom } from "../binding-support.js";
import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "This selector allocates a new {{kind}} on every snapshot, so the default === comparison never matches and the component re-renders each time: select primitives or existing references, or pass a comparator such as shallowEqual.";

const selectorSources: readonly string[] = ["@xstate/react", "@xstate/store-react", "@xstate/store/react"];

const allocatingArrayMethods: ReadonlySet<string> = new Set(["map", "filter", "flatMap", "toSorted"]);

const allocatingObjectStatics: ReadonlySet<string> = new Set(["keys", "values", "entries"]);

function returnedExpression(selector: ESTree.Node): ESTree.Node | undefined {
  if (!isFunctionNode(selector) || selector.body === null) return undefined;
  if (selector.body.type !== "BlockStatement") return unwrapExpression(selector.body);
  const [only, ...rest] = selector.body.body;
  if (only?.type !== "ReturnStatement" || rest.length > 0 || only.argument === null) return undefined;
  return unwrapExpression(only.argument);
}

function allocationKind(result: ESTree.Node): string | undefined {
  if (result.type === "ObjectExpression") return "object";
  if (result.type === "ArrayExpression") return "array";
  if (result.type !== "CallExpression" || result.callee.type !== "MemberExpression") return undefined;
  const method = memberPropertyName(result.callee);
  if (method === undefined) return undefined;
  const owner = result.callee.object;
  if (owner.type === "Identifier" && owner.name === "Object")
    return allocatingObjectStatics.has(method) ? "array" : undefined;
  return allocatingArrayMethods.has(method) ? "array" : undefined;
}

export const stableSelectorResult: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid inline useSelector selectors that return a fresh object or array when no comparator argument is passed.",
    },
    messages: {
      stableSelectorResult: message,
    },
    schema: [],
  },
  createOnce(context) {
    let enabled = false;
    return {
      Program(node) {
        enabled = importsFrom(node, selectorSources);
      },
      CallExpression(node) {
        if (!enabled) return;
        const standalone = importedNameFrom(context, node.callee, selectorSources) === "useSelector";
        if (!standalone && memberPropertyName(node.callee) !== "useSelector") return;
        const selectorIndex = standalone ? 1 : 0;
        if (node.arguments.length > selectorIndex + 1) return;
        const selector = node.arguments[selectorIndex];
        if (selector === undefined || selector.type === "SpreadElement") return;
        const result = returnedExpression(unwrapExpression(selector));
        const kind = result === undefined ? undefined : allocationKind(result);
        if (result === undefined || kind === undefined) return;
        context.report({ node: result, messageId: "stableSelectorResult", data: { kind } });
      },
    };
  },
};
