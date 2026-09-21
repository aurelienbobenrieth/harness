import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod, moduleMethod } from "../binding-support.js";
import { getFilename, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";

const message =
  "Use typed Effect failures instead of converting failures to defects with Effect.orDie, Layer.orDie, or a catch handler that only dies.";
const defaultAllow: readonly string[] = [];
const defaultAllowedCalls: readonly string[] = [];

type RuleOptions = {
  readonly allow?: readonly string[];
  readonly allowedCalls?: readonly string[];
};

function getOptions(context: RuleContextWithOptions): RuleOptions {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null) return {};

  const allow = (candidate as { readonly allow?: unknown }).allow;
  const allowedCalls = (candidate as { readonly allowedCalls?: unknown }).allowedCalls;

  return {
    allow: Array.isArray(allow) && allow.every((entry) => typeof entry === "string") ? allow : undefined,
    allowedCalls:
      Array.isArray(allowedCalls) && allowedCalls.every((entry) => typeof entry === "string")
        ? allowedCalls
        : undefined,
  };
}

type ErasureName = "orDie" | "orDieWith" | "Layer.orDie" | "catchDie";

function isDieCall(context: Context, node: ESTree.Node | null | undefined): boolean {
  return node?.type === "CallExpression" && effectMethod(context, node.callee) === "die";
}

/** Recognize `Effect.catch(Effect.die)` and handlers whose whole body is `Effect.die(...)`. */
function isDieOnlyHandler(context: Context, handler: ESTree.Node | undefined): boolean {
  if (handler === undefined) return false;
  if (effectMethod(context, handler) === "die") return true;
  if (handler.type !== "ArrowFunctionExpression" && handler.type !== "FunctionExpression") return false;
  if (handler.body === null) return false;
  if (handler.body.type !== "BlockStatement") return isDieCall(context, handler.body);

  const [statement, ...rest] = handler.body.body;
  return rest.length === 0 && statement?.type === "ReturnStatement" && isDieCall(context, statement.argument);
}

function getErasureName(context: Context, node: ESTree.MemberExpression): ErasureName | undefined {
  const method = effectMethod(context, node);
  if (method === "orDie" || method === "orDieWith") return method;
  if (moduleMethod(context, node, "Layer") === "orDie") return "Layer.orDie";
  if (method !== "catch" && method !== "catchAll") return undefined;

  const call = node.parent;
  if (call.type !== "CallExpression" || call.callee !== node) return undefined;
  return isDieOnlyHandler(context, call.arguments.at(-1)) ? "catchDie" : undefined;
}

export const noEffectOrDie: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.orDie, Effect.orDieWith, Layer.orDie, and Effect.catch handlers that only die outside configured escape hatches.",
    },
    messages: {
      noEffectOrDie: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "array",
            items: { type: "string" },
          },
          allowedCalls: {
            type: "array",
            items: { enum: ["orDie", "orDieWith", "Layer.orDie", "catchDie"] },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [...defaultAllow], allowedCalls: [...defaultAllowedCalls] }],
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        const callName = getErasureName(context, node);
        if (callName === undefined) return;

        const options = getOptions(context as RuleContextWithOptions);
        const allow = options.allow ?? defaultAllow;
        const allowedCalls = options.allowedCalls ?? defaultAllowedCalls;
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;

        if (allowedCalls.includes(callName)) return;

        context.report({
          node,
          messageId: "noEffectOrDie",
        });
      },
    };
  },
};
