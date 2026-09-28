/**
 * Require every `effect/Config` key a Runtime handler reads to also be read in
 * the Runtime's init, where Alchemy discovers and binds it at deploy time.
 *
 * @attribution https://alchemy.run/environments/secrets (alchemy-run/alchemy docs, Apache-2.0; inspiration, independently implemented)
 */
import { type FunctionNode, nearestFunction, parentOf, walk } from "@aurelienbbn/oxlint-kit/ast";
import type { ESTree, Rule } from "@oxlint/plugins";
import { configKey, initGenerator, isWithin, runtimeDeclaration, runtimeRoots } from "../runtime.js";

const message =
  'Config "{{key}}" is read only in the runtime half of this init, which never runs at deploy time, so Alchemy never binds it and the deployed runtime lacks the value. Read it with `yield*` in the init body and use the captured value in the handler.';

/** True when a `yield*` owned by the init generator evaluates `node` during construction, e.g. `return { a: yield* cfg }`. */
function yieldedByInit(node: ESTree.Node, root: ESTree.Node, generator: FunctionNode | undefined): boolean {
  let current = parentOf(node);
  while (current !== undefined && current !== parentOf(root)) {
    if (current.type === "YieldExpression" && nearestFunction(current) === generator) return true;
    current = parentOf(current);
  }
  return false;
}

export const configInInit: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require effect/Config keys read inside the handlers, Durable Object instance, or Workflow body returned by an Alchemy Runtime init to also be read in the init itself, where Alchemy binds them at deploy time.",
    },
    messages: {
      configOnlyAtRuntime: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const declaration = runtimeDeclaration(context, node);
        if (declaration?.init === undefined) return;
        const roots = runtimeRoots(context, declaration);
        if (roots.length === 0) return;
        const generator = initGenerator(context, declaration);

        const bound = new Set<string>();
        const runtimeReads: { readonly node: ESTree.Node; readonly key: string }[] = [];
        for (const argument of node.arguments) {
          walk(argument as ESTree.Node, (child) => {
            const key = configKey(context, child);
            if (key === undefined) return;
            const root = roots.find((candidate) => isWithin(child, candidate));
            if (root === undefined || yieldedByInit(child, root, generator)) bound.add(key);
            else runtimeReads.push({ node: child, key });
          });
        }

        for (const read of runtimeReads) {
          if (bound.has(read.key)) continue;
          context.report({ node: read.node, messageId: "configOnlyAtRuntime", data: { key: read.key } });
        }
      },
    };
  },
};
