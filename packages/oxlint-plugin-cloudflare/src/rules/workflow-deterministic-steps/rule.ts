/**
 * Require Workflow step names and the code between steps to be deterministic,
 * so a replayed `run()` resolves every step from its cached result.
 *
 * @attribution https://developers.cloudflare.com/workflows/build/rules-of-workflows/ (inspiration; independently implemented)
 */
import {
  type FunctionNode,
  isFunctionNode,
  memberPropertyName,
  parentOf,
  propertyKeyName,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import { enclosingClass, extendsWorkersClass, isNondeterministicCall, methodOf } from "../ast.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const nameMessage =
  "This step name changes on every run, so a replay never finds the cached result and the step executes again. Build step names only from literals and values returned by earlier steps.";

const outsideMessage =
  "This value differs on every replay of run(), so the Workflow can branch differently after a restart. Produce it inside a step.do() callback and use the value the step returns.";

const stepMethods: ReadonlySet<string> = new Set(["do", "sleep", "sleepUntil", "waitForEvent"]);

/** The `run(event, step)` method function of a `WorkflowEntrypoint` subclass enclosing `node`. */
function enclosingRun(context: Context, node: ESTree.Node): FunctionNode | undefined {
  let current = parentOf(node);
  while (current !== undefined) {
    if (isFunctionNode(current)) {
      const method = methodOf(current);
      if (method !== undefined && propertyKeyName(method) === "run" && !method.static) {
        const owner = enclosingClass(method);
        return owner !== undefined && extendsWorkersClass(context, owner, ["WorkflowEntrypoint"]) ? current : undefined;
      }
    }
    current = parentOf(current);
  }
  return undefined;
}

function stepMethod(node: ESTree.Node, stepName: string): string | undefined {
  if (node.type !== "CallExpression") return undefined;
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression") return undefined;
  const owner = unwrapExpression(callee.object);
  if (owner.type !== "Identifier" || owner.name !== stepName) return undefined;
  const method = memberPropertyName(callee);
  return method !== undefined && stepMethods.has(method) ? method : undefined;
}

type Placement = "name" | "inside-step" | "outside-step";

function placement(node: ESTree.Node, run: FunctionNode, stepName: string): Placement {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined && current !== run) {
    const method = stepMethod(current, stepName);
    if (method !== undefined && current.type === "CallExpression") {
      if (current.arguments[0] === child) return "name";
      if (method === "do" && isFunctionNode(child)) return "inside-step";
    }
    child = current;
    current = parentOf(current);
  }
  return "outside-step";
}

export const workflowDeterministicSteps: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid Date.now(), Math.random(), performance.now(), crypto.randomUUID(), crypto.getRandomValues() and new Date() in Workflow step names, or anywhere in WorkflowEntrypoint.run() outside a step.do() callback.",
    },
    messages: {
      nondeterministicStepName: nameMessage,
      nondeterminismOutsideStep: outsideMessage,
    },
    schema: [],
  },
  createOnce(context) {
    function check(node: ESTree.CallExpression | ESTree.NewExpression): void {
      if (!isNondeterministicCall(context, node)) return;
      const run = enclosingRun(context, node);
      const step = run?.params[1];
      if (run === undefined || step?.type !== "Identifier") return;
      const where = placement(node, run, step.name);
      if (where === "inside-step") return;
      context.report({
        node,
        messageId: where === "name" ? "nondeterministicStepName" : "nondeterminismOutsideStep",
      });
    }
    return {
      CallExpression: check,
      NewExpression: check,
    };
  },
};
