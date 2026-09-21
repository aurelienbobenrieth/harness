import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod } from "../binding-support.js";
import { defaultAllow, getFilename, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";
import { optionsObject, parentOf, stringArrayOption, unwrapExpression } from "../sota-support.js";

const message =
  "Launch the process with NodeRuntime.runMain or BunRuntime.runMain instead of a top-level Effect.{{method}}: runMain interrupts fibers on SIGINT/SIGTERM, runs finalizers, and sets the exit code.";

const entrypointRunners: ReadonlySet<string> = new Set(["runPromise", "runPromiseExit", "runFork"]);
const promiseChainMethods: ReadonlySet<string> = new Set(["then", "catch", "finally"]);

function memberName(node: ESTree.Node): string | undefined {
  return node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier"
    ? node.property.name
    : undefined;
}

function launchedMethod(context: Context, input: ESTree.Node): string | undefined {
  let node = unwrapExpression(input);
  for (;;) {
    if (node.type === "AwaitExpression") node = unwrapExpression(node.argument);
    else if (node.type === "UnaryExpression" && node.operator === "void") node = unwrapExpression(node.argument);
    else if (node.type === "CallExpression" && promiseChainMethods.has(memberName(node.callee) ?? "")) {
      node = unwrapExpression((node.callee as ESTree.MemberExpression).object);
    } else break;
  }
  if (node.type !== "CallExpression") return undefined;

  const direct = effectMethod(context, node.callee);
  if (direct !== undefined) return entrypointRunners.has(direct) ? direct : undefined;
  if (memberName(node.callee) !== "pipe") return undefined;
  const last = node.arguments.at(-1);
  const piped = last === undefined || last.type === "SpreadElement" ? undefined : effectMethod(context, last);
  return piped !== undefined && entrypointRunners.has(piped) ? piped : undefined;
}

/** Prefer the platform `runMain` launcher for module-level program starts. */
export const preferRunMain: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer NodeRuntime.runMain or BunRuntime.runMain over a module top-level Effect.runPromise or Effect.runFork statement.",
    },
    messages: { preferRunMain: message },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [...defaultAllow] }],
  },
  createOnce(context) {
    return {
      ExpressionStatement(node) {
        if (parentOf(node)?.type !== "Program") return;
        const method = launchedMethod(context, node.expression);
        if (method === undefined) return;

        const allow = stringArrayOption(optionsObject(context), "allow", defaultAllow);
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;

        context.report({ node: node.expression, messageId: "preferRunMain", data: { method } });
      },
    };
  },
};
