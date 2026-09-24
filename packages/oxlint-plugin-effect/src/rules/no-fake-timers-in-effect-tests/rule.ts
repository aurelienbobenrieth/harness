import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { binding } from "../binding-support.js";

const message =
  "vi.{{method}} drives Vitest's fake timers, not Effect's clock: it.effect runs on TestClock. Advance virtual time with TestClock.adjust or TestClock.setTime from effect/testing.";

const fakeTimerMethods: ReadonlySet<string> = new Set([
  "useFakeTimers",
  "advanceTimersByTime",
  "advanceTimersByTimeAsync",
  "advanceTimersToNextTimer",
  "advanceTimersToNextTimerAsync",
  "runAllTimers",
  "runAllTimersAsync",
  "runOnlyPendingTimers",
  "runOnlyPendingTimersAsync",
  "setSystemTime",
]);

const vitestModules: ReadonlySet<string> = new Set(["vitest", "@effect/vitest"]);

function importsEffectVitest(program: ESTree.Program): boolean {
  return program.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      typeof statement.source.value === "string" &&
      (statement.source.value === "@effect/vitest" || statement.source.value.startsWith("@effect/vitest/")),
  );
}

/** `vi` is either the Vitest global or an import from `vitest` / `@effect/vitest`; a local shadow never matches. */
function isVitestUtility(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier" || node.name !== "vi") return false;
  const variable = binding(context, node, "vi");
  if (variable === undefined || variable.defs.length === 0) return true;
  return variable.defs.some((definition) => {
    if (definition.parent?.type !== "ImportDeclaration") return false;
    const source = definition.parent.source.value;
    return typeof source === "string" && vitestModules.has(source);
  });
}

function fakeTimerMethod(context: Context, callee: ESTree.Node): string | undefined {
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return undefined;
  if (!fakeTimerMethods.has(callee.property.name) || !isVitestUtility(context, callee.object)) return undefined;
  return callee.property.name;
}

/**
 * Reports Vitest fake-timer calls in files that use `@effect/vitest`, where `it.effect` runs on `TestClock` and
 * wall-clock mocking never moves Effect time.
 *
 * @attribution Effect bundled ai-docs `09_testing/10_effect-tests.ts` "controls time with TestClock" (concept)
 */
export const noFakeTimersInEffectTests: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow vi.useFakeTimers, vi.advanceTimers*, vi.run*Timers, and vi.setSystemTime in files importing @effect/vitest; use TestClock.",
    },
    messages: { noFakeTimers: message },
  },
  createOnce(context) {
    let usesEffectVitest = false;

    return {
      Program(node) {
        usesEffectVitest = importsEffectVitest(node);
      },
      CallExpression(node) {
        if (!usesEffectVitest) return;
        const method = fakeTimerMethod(context, node.callee);
        if (method === undefined) return;

        context.report({ node, messageId: "noFakeTimers", data: { method } });
      },
    };
  },
};
