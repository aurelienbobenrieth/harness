import type { Rule } from "@oxlint/plugins";
import { effectMethod } from "../binding-support.js";
import {
  defaultAllow,
  getFilename,
  getOptions,
  isAllowedFile,
  type RuleContextWithOptions,
} from "../runtime-support.js";

const message =
  "Run Effects only at configured runtime boundaries instead of using Effect.runPromise, Effect.runPromiseExit, or their run*With variants here.";
const promiseRunners = new Set(["runPromise", "runPromiseExit", "runPromiseWith", "runPromiseExitWith"]);

export const noRunPromiseInRuntime: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.runPromise, runPromiseExit, and their run*With variants outside configured runtime boundaries.",
    },
    messages: {
      noRunPromise: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: defaultAllow }],
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        if (!promiseRunners.has(effectMethod(context, node) ?? "")) return;

        const options = getOptions(context as RuleContextWithOptions);
        const allow = options.allow ?? defaultAllow;
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;

        context.report({
          node: node.parent.type === "CallExpression" && node.parent.callee === node ? node.parent : node,
          messageId: "noRunPromise",
        });
      },
    };
  },
};
