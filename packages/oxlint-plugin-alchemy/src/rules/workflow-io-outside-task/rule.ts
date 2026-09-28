/**
 * Require calls on bindings acquired in an Alchemy Workflow's init to run
 * inside `Cloudflare.Workflows.task(...)`: everything outside a task runs again
 * on every replay of the Workflow body.
 *
 * @attribution https://alchemy.run/cloudflare/compute/workflows (alchemy-run/alchemy docs, Apache-2.0; inspiration, independently implemented)
 */
import {
  type FunctionNode,
  binding,
  isFunctionNode,
  nearestFunction,
  parentOf,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { alchemyPath, effectGenGenerator, effectMember, insideCallArguments, returningInit } from "../runtime.js";

const message =
  "`{{name}}` is a binding, and this call sits outside a Workflow task, so it runs again on every replay of the Workflow body. Wrap it in `Cloudflare.Workflows.task(name, effect)` so its result is checkpointed and the side effect runs once.";

const taskPaths: ReadonlySet<string> = new Set(["Cloudflare.Workflows.task", "Cloudflare.task"]);

/**
 * The Workflow init generator whose returned body is `fn`: the function passed
 * to `Effect.fn(...)` / `Effect.fn(name)(...)`, or the generator of an
 * `Effect.gen(...)` an arrow body returns.
 */
function workflowInitOfBody(context: Context, fn: FunctionNode): FunctionNode | undefined {
  let returned: ESTree.Node | undefined;
  const call = parentOf(fn);
  if (call?.type === "CallExpression" && call.arguments.includes(fn as ESTree.Expression)) {
    const callee = unwrapExpression(call.callee);
    const curried = callee.type === "CallExpression" ? callee.callee : callee;
    if (effectMember(context, curried, "Effect") === "fn") returned = call;
    else if (effectGenGenerator(context, call) === fn) {
      const arrow = parentOf(call);
      if (arrow?.type === "ArrowFunctionExpression" && arrow.body === call) returned = arrow;
    }
  }
  if (returned === undefined) return undefined;
  const owner = returningInit(context, returned);
  return owner?.declaration.kind === "workflow" ? owner.generator : undefined;
}

/** True when `name` is declared in `init` as `const name = yield* <alchemy binding>`. */
function isInitBinding(
  context: Context,
  identifier: ESTree.Node & { readonly name: string },
  init: FunctionNode,
): boolean {
  return (binding(context, identifier, identifier.name)?.defs ?? []).some((definition) => {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator" || declarator.id.type !== "Identifier") return false;
    if (nearestFunction(declarator) !== init) return false;
    const value =
      declarator.init === null || declarator.init === undefined ? undefined : unwrapExpression(declarator.init);
    if (value?.type !== "YieldExpression" || !value.delegate || value.argument === null || value.argument === undefined)
      return false;
    const yielded = unwrapExpression(value.argument);
    return alchemyPath(context, yielded.type === "CallExpression" ? yielded.callee : yielded) !== undefined;
  });
}

export const workflowIoOutsideTask: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require method calls on bindings yielded from Alchemy in a Cloudflare Workflow init (KV, R2, D1, Durable Objects, ...) to run inside Cloudflare.Workflows.task() when made directly in the Workflow body.",
    },
    messages: {
      ioOutsideTask: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = unwrapExpression(node.callee);
        if (callee.type !== "MemberExpression") return;
        const receiver = unwrapExpression(callee.object);
        if (receiver.type !== "Identifier") return;
        const body = nearestFunction(node);
        if (body === undefined || !isFunctionNode(body)) return;
        const init = workflowInitOfBody(context, body);
        if (init === undefined || !isInitBinding(context, receiver, init)) return;
        if (insideCallArguments(node, body, (call) => taskPaths.has(alchemyPath(context, call.callee) ?? ""))) return;
        context.report({ node, messageId: "ioOutsideTask", data: { name: receiver.name } });
      },
    };
  },
};
