import type { Rule } from "@oxlint/plugins";
import { nearestFunction } from "@aurelienbbn/oxlint-kit/ast";
import { moduleMethod } from "../binding-support.js";
import {
  defaultAllow,
  getFilename,
  getOptions,
  isAllowedFile,
  type RuleContextWithOptions,
} from "../runtime-support.js";

const message =
  "ManagedRuntime.make inside a function builds every layer again on each call and leaks the runtime unless dispose is awaited. Create the runtime once at module scope or in the composition root and pass it in.";

/**
 * Reports `ManagedRuntime.make` calls nested in any function body, where each invocation of the enclosing handler,
 * hook, or factory builds a fresh runtime with its own layer instances.
 *
 * @attribution Effect bundled ai-docs `04_integration/10_managed-runtime.ts` module-level runtime (concept)
 */
export const noManagedRuntimePerCall: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ManagedRuntime.make inside function bodies outside configured files; build the runtime once at module scope.",
    },
    messages: { noManagedRuntimePerCall: message },
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
      CallExpression(node) {
        if (moduleMethod(context, node.callee, "ManagedRuntime") !== "make") return;
        if (nearestFunction(node) === undefined) return;

        const options = getOptions(context as RuleContextWithOptions);
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), options.allow ?? defaultAllow)) return;

        context.report({ node, messageId: "noManagedRuntimePerCall" });
      },
    };
  },
};
