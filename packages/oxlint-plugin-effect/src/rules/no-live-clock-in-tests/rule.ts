import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { moduleMethod } from "../binding-support.js";
import { getFilename, type RuleContextWithOptions } from "../runtime-support.js";

const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/u;

/** The live-clock read a call makes past the provided Clock service, or `undefined`. */
function liveClockRead(context: Context, callee: ESTree.Node): string | undefined {
  if (moduleMethod(context, callee, "DateTime") === "nowUnsafe") return "DateTime.nowUnsafe()";
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return undefined;
  if (callee.property.name !== "defaultValue") return undefined;

  return moduleMethod(context, callee.object, "Clock") === "Clock" ? "Clock.Clock.defaultValue()" : undefined;
}

/**
 * Reports reads of the live clock that bypass the `Clock` service `it.effect` replaces with `TestClock`.
 *
 * @attribution Effect bundled ai-docs `09_testing/10_effect-tests.ts` "controls time with TestClock" (concept)
 */
export const noLiveClockInTests: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Clock.Clock.defaultValue() and DateTime.nowUnsafe() in test files: both read the machine's clock past the TestClock that it.effect provides.",
    },
    schema: [{ type: "object", properties: { allFiles: { type: "boolean" } }, additionalProperties: false }],
    messages: {
      liveClock:
        "{{call}} reads the machine's clock past TestClock, so this test sees a different instant on every run. Read time through Clock.currentTimeMillis or DateTime.now, and move it with TestClock.adjust or TestClock.setTime.",
    },
  },
  create(context) {
    const options = context.options[0] as { readonly allFiles?: boolean } | undefined;

    if (options?.allFiles !== true && !testFilePattern.test(getFilename(context as RuleContextWithOptions))) return {};

    return {
      CallExpression(node) {
        const call = liveClockRead(context, node.callee);

        if (call !== undefined) context.report({ node, messageId: "liveClock", data: { call } });
      },
    };
  },
};
