import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod } from "../binding-support.js";
import { getFilename, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";
import {
  moduleMethod,
  nearestFunction,
  optionsObject,
  parentOf,
  stringArrayOption,
  walk,
  type FunctionNode,
} from "../sota-support.js";

const detachedForks: ReadonlySet<string> = new Set(["forkDetach", "forkDaemon"]);
const childForks: ReadonlySet<string> = new Set(["forkChild", "fork"]);
const layerConstructors: ReadonlySet<string> = new Set([
  "effect",
  "effectDiscard",
  "effectContext",
  "unwrap",
  "scoped",
  "scopedDiscard",
]);
const fiberObservers: ReadonlySet<string> = new Set(["join", "await", "joinAll", "awaitAll"]);

function isPipeCall(node: ESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "pipe"
  );
}

function isLayerConstructorCall(context: Context, node: ESTree.Node | undefined): boolean {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee.type === "CallExpression" ? node.callee.callee : node.callee;
  const method = moduleMethod(context, callee, "Layer");
  return method !== undefined && layerConstructors.has(method);
}

/** True when the function is the layer constructor itself: `Layer.effect(tag, Effect.gen(fn))`, piped or curried. */
function isLayerConstructorBody(context: Context, fn: FunctionNode): boolean {
  let value: ESTree.Node = fn;
  const genCall = parentOf(fn);
  if (genCall?.type === "CallExpression" && effectMethod(context, genCall.callee) === "gen") value = genCall;

  for (;;) {
    const parent = parentOf(value);
    if (parent === undefined) return false;
    if (parent.type === "MemberExpression" && parent.object === value) {
      const pipeCall = parentOf(parent);
      if (pipeCall === undefined || !isPipeCall(pipeCall)) return false;
      value = pipeCall;
      continue;
    }
    return (
      parent.type === "CallExpression" &&
      parent.arguments.includes(value as ESTree.Expression) &&
      isLayerConstructorCall(context, parent)
    );
  }
}

function observesFiber(context: Context, fn: FunctionNode): boolean {
  let found = false;
  walk(fn, (node) => {
    if (node.type === "MemberExpression") {
      const method = moduleMethod(context, node, "Fiber");
      if (method !== undefined && fiberObservers.has(method)) found = true;
    }
    return !found;
  });
  return found;
}

/** Require forked fibers to have an owner whose lifetime matches the work. */
export const noForkDetach: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.forkDetach outside configured files and Effect.forkChild directly inside Layer constructors, where Effect.forkScoped ties the fiber to the layer scope.",
    },
    hasSuggestions: true,
    messages: {
      detach:
        "Give this fiber an owner with Effect.forkScoped or Effect.forkIn: a detached fiber outlives tests, runtime disposal, and hot reloads, and its failures are never observed.",
      layerChild:
        "Fork with Effect.forkScoped inside a Layer constructor: forkChild ties the fiber to whichever fiber builds the layer, so layer teardown never stops it.",
      useForkScoped: "Replace with Effect.forkScoped.",
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        const method = effectMethod(context, node);
        if (method === undefined) return;

        if (detachedForks.has(method)) {
          const allow = stringArrayOption(optionsObject(context), "allow", []);
          if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;
          context.report({ node, messageId: "detach" });
          return;
        }

        if (!childForks.has(method)) return;
        const owner = nearestFunction(node);
        if (owner === undefined || !isLayerConstructorBody(context, owner) || observesFiber(context, owner)) return;

        context.report({
          node,
          messageId: "layerChild",
          suggest: [
            {
              messageId: "useForkScoped",
              fix: (fixer) => fixer.replaceText(node.property, "forkScoped"),
            },
          ],
        });
      },
    };
  },
};
