/**
 * Require `@xstate/effect` logic to be started with `createEffectActor`, not
 * with XState's `createActor` or the `@xstate/react` hooks built on it.
 */
import { memberPropertyName, unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { boundInitializer, effectIntegrationImport, reactIntegrationImport, xstateImport } from "../v6-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "{{callee}}() starts @xstate/effect logic without an Effect host, so the actor lands in status 'error' instead of running. Start it with yield* createEffectActor(logic) inside a Scope, or with createActorAtoms(runtime, logic) from @xstate/effect/atom in React.";

const reactStarters: ReadonlySet<string> = new Set(["createActorContext", "useActor", "useActorRef", "useMachine"]);

const effectLogicCreators: ReadonlySet<string> = new Set(["fromEffect", "fromEffectEventStream", "fromEffectStream"]);

const maxBindingDepth = 8;

function isEffectSetup(context: Context, node: ESTree.Node, depth: number): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (value.type === "CallExpression") {
    if (effectIntegrationImport(context, value.callee) === "setupEffect") return true;
    return (
      value.callee.type === "MemberExpression" &&
      memberPropertyName(value.callee) === "extend" &&
      isEffectSetup(context, value.callee.object, depth)
    );
  }
  const initial = depth < maxBindingDepth ? boundInitializer(context, value) : undefined;
  return initial !== undefined && isEffectSetup(context, initial, depth + 1);
}

/**
 * True for logic that needs an Effect host: `fromEffect*(...)`, a machine from
 * `setupEffect(...).createMachine(...)`, a `.provide(...)` of either, or a
 * variable initialised by one.
 */
function isEffectLogic(context: Context, node: ESTree.Node, depth: number): boolean {
  const value = unwrapExpressionKeepingChain(node);
  if (value.type === "CallExpression") {
    const imported = effectIntegrationImport(context, value.callee);
    if (imported !== undefined) return effectLogicCreators.has(imported);
    if (value.callee.type !== "MemberExpression") return false;
    const method = memberPropertyName(value.callee);
    if (method === "createMachine") return isEffectSetup(context, value.callee.object, depth);
    return method === "provide" && isEffectLogic(context, value.callee.object, depth);
  }
  const initial = depth < maxBindingDepth ? boundInitializer(context, value) : undefined;
  return initial !== undefined && isEffectLogic(context, initial, depth + 1);
}

function starterName(context: Context, callee: ESTree.Node): string | undefined {
  if (xstateImport(context, callee) === "createActor") return "createActor";
  const hook = reactIntegrationImport(context, callee);
  return hook !== undefined && reactStarters.has(hook) ? hook : undefined;
}

export const requireEffectActor: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require @xstate/effect logic (fromEffect*, setupEffect machines) to be started with createEffectActor instead of createActor or @xstate/react hooks.",
    },
    messages: {
      requireEffectActor: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = starterName(context, node.callee);
        if (callee === undefined) return;
        const logic = node.arguments[0];
        if (logic === undefined || logic.type === "SpreadElement") return;
        if (!isEffectLogic(context, logic, 0)) return;
        context.report({ node, messageId: "requireEffectActor", data: { callee } });
      },
    };
  },
};
