/**
 * Forbid creating machines, actors and actor atoms directly in a React component or hook body.
 */
import { type FunctionNode, memberPropertyName, nearestFunction, parentOf } from "@aurelienbbn/oxlint-kit/ast";
import { importsFrom, isSetupResult } from "../ast.js";
import { effectImportedName, importedName, isSystemResult } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "{{callee}}() runs on every render here: each render rebuilds the machine or creates an actor nobody stops, and with XState v5 a new machine identity also replaces the running actor. Define machines and actor atoms at module scope (pass per-instance data through input) and create actors with useMachine/useActorRef.";

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
  if (effectImportedName(context, callee) === "createActorAtoms") return "createActorAtoms";
  if (callee.type !== "MemberExpression") return undefined;
  const method = memberPropertyName(callee);
  if (method === "createMachine") return isSetupResult(context, callee.object) ? "createMachine" : undefined;
  if (method === "createActor") return isSystemResult(context, callee.object) ? "createActor" : undefined;
  return undefined;
}

export const noMachineInRender: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid createMachine, setup().createMachine, createActor, system.createActor, interpret and createActorAtoms calls directly in a React component or hook body.",
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
