/**
 * Forbid creating machines and actors directly in a React component or hook body.
 */
import { type FunctionNode, memberPropertyName, nearestFunction, parentOf } from "@aurelienbbn/oxlint-kit/ast";
import { importsFrom, isSetupResult } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "{{callee}}() runs on every render here: a new machine identity replaces the running actor and an unmanaged actor leaks. Define the machine at module scope (pass per-instance data through input) and create actors with useMachine/useActorRef.";

const renderScopedCreators: ReadonlySet<string> = new Set(["createMachine", "createActor", "interpret"]);

const componentWrappers: ReadonlySet<string> = new Set(["memo", "forwardRef"]);

const renderFunctionName = /^(?:[A-Z]|use[A-Z])/;

function functionName(fn: FunctionNode): string | undefined {
  if (fn.id?.type === "Identifier") return fn.id.name;
  let holder = parentOf(fn);
  while (holder?.type === "CallExpression") {
    const wrapper = holder.callee.type === "Identifier" ? holder.callee.name : memberPropertyName(holder.callee);
    if (wrapper === undefined || !componentWrappers.has(wrapper)) return undefined;
    holder = parentOf(holder);
  }
  return holder?.type === "VariableDeclarator" && holder.id.type === "Identifier" ? holder.id.name : undefined;
}

function creatorName(context: Context, callee: ESTree.Node): string | undefined {
  const imported = importedName(context, callee);
  if (imported !== undefined) return renderScopedCreators.has(imported) ? imported : undefined;
  if (memberPropertyName(callee) !== "createMachine" || callee.type !== "MemberExpression") return undefined;
  return isSetupResult(context, callee.object) ? "createMachine" : undefined;
}

export const noMachineInRender: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid createMachine, setup().createMachine, createActor and interpret calls directly in a React component or hook body.",
    },
    messages: {
      noMachineInRender: message,
    },
    schema: [],
  },
  createOnce(context) {
    let enabled = false;
    return {
      Program(node) {
        enabled = importsFrom(node, ["@xstate/react", "react"]);
      },
      CallExpression(node) {
        if (!enabled) return;
        const callee = creatorName(context, node.callee);
        if (callee === undefined) return;
        const fn = nearestFunction(node);
        if (fn === undefined) return;
        const name = functionName(fn);
        if (name === undefined || !renderFunctionName.test(name)) return;
        context.report({ node, messageId: "noMachineInRender", data: { callee } });
      },
    };
  },
};
