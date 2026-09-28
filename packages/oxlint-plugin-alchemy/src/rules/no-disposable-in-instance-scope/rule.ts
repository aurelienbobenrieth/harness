/**
 * Forbid scope-bound resources in an Alchemy Runtime's init: its scope lives as
 * long as the isolate or sandbox, so their finalizers never run on workerd and
 * get at most a best-effort shutdown window on Lambda.
 *
 * @attribution https://alchemy.run/infrastructure-as-effects/runtime (alchemy-run/alchemy docs, Apache-2.0; inspiration, independently implemented)
 */
import { type FunctionNode, nearestFunction, parentOf } from "@aurelienbbn/oxlint-kit/ast";
import type { Context, Rule } from "@oxlint/plugins";
import {
  declarationOfInitGenerator,
  effectGenGenerator,
  effectMember,
  insideCallArguments,
  isWithin,
  returnedExpressions,
  returningInit,
} from "../runtime.js";

const message =
  "Effect.{{method}} here attaches its finalizer to the Runtime's instance scope, which never closes on workerd and only gets a best-effort 500 ms SIGTERM window on Lambda, so the resource is never reliably released. Acquire it inside the handler, where every event gets its own scope, or wrap construction-only use in Effect.scoped.";

/** Effect constructors whose result requires a `Scope` and registers a finalizer in it. */
const scopedAcquirers: ReadonlySet<string> = new Set(["acquireRelease", "acquireDisposable", "addFinalizer"]);

/**
 * True for a function whose body runs in the instance scope: the init generator
 * of a Runtime declaration, or the per-object constructor a Durable Object init
 * returns as `Effect.gen(...)`.
 */
function isInstanceConstructor(context: Context, fn: FunctionNode): boolean {
  if (declarationOfInitGenerator(context, fn) !== undefined) return true;
  const genCall = parentOf(fn);
  if (genCall?.type !== "CallExpression" || effectGenGenerator(context, genCall) !== fn) return false;
  return returningInit(context, genCall)?.declaration.kind === "durable-object";
}

export const noDisposableInInstanceScope: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid Effect.acquireRelease, Effect.acquireDisposable and Effect.addFinalizer directly in an Alchemy Runtime init (Cloudflare Worker, Durable Object, Workflow, AWS Lambda Function) outside the handlers it returns.",
    },
    messages: {
      instanceScopedResource: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      // A member reference, so point-free uses such as `socket.pipe(Effect.acquireDisposable)` count too.
      MemberExpression(node) {
        const method = effectMember(context, node, "Effect");
        if (method === undefined || !scopedAcquirers.has(method)) return;
        const owner = nearestFunction(node);
        if (owner === undefined || !isInstanceConstructor(context, owner)) return;
        if (returnedExpressions(owner).some((returned) => isWithin(node, returned))) return;
        // `Effect.scoped(...)` closes its own scope as soon as the wrapped effect completes.
        if (insideCallArguments(node, owner, (call) => effectMember(context, call.callee, "Effect") === "scoped"))
          return;
        context.report({ node, messageId: "instanceScopedResource", data: { method } });
      },
    };
  },
};
