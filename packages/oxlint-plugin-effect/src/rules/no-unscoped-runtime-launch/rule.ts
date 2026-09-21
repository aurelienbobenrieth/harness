import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod, moduleMethod } from "../binding-support.js";
import {
  defaultAllow,
  getFilename,
  getOptions,
  isAllowedFile,
  type RuleContextWithOptions,
} from "../runtime-support.js";

const message = "Launch Effects and Layers only from configured runtime boundary files.";
const launchers = new Set([
  "runFork",
  "runForkWith",
  "runSync",
  "runSyncWith",
  "runSyncExit",
  "runSyncExitWith",
  "runCallback",
  "runCallbackWith",
]);

function isRuntimeLaunchReference(context: Context, node: ESTree.Node): boolean {
  return launchers.has(effectMethod(context, node) ?? "") || moduleMethod(context, node, "Layer") === "launch";
}

export const noUnscopedRuntimeLaunch: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.runFork, runSync, runSyncExit, runCallback, their run*With variants, and Layer.launch outside configured runtime boundaries.",
    },
    messages: {
      noUnscopedRuntimeLaunch: message,
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
        if (!isRuntimeLaunchReference(context, node)) return;

        const options = getOptions(context as RuleContextWithOptions);
        const allow = options.allow ?? defaultAllow;
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;

        context.report({
          node: node.parent.type === "CallExpression" && node.parent.callee === node ? node.parent : node,
          messageId: "noUnscopedRuntimeLaunch",
        });
      },
    };
  },
};
