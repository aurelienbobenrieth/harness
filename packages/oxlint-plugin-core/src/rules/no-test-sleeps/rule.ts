import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isInlineFunction, resolveVariable, someDescendant, unwrapExpression } from "../ast-support.js";
import { isTestFile, type RuleContextWithFilename } from "../filename-support.js";
import { testApi } from "../test-api-support.js";

const timerPromiseModules = new Set(["node:timers/promises", "timers/promises"]);
const sleepingTimerExports = new Set(["setTimeout", "scheduler"]);
const sleepHelperNames = new Set(["sleep", "delay", "wait", "pause"]);
const globalObjectNames = new Set(["globalThis", "window", "self", "global"]);

function isGlobalSetTimeout(context: Context, callee: ESTree.Node): boolean {
  const target = unwrapExpression(callee);
  if (target.type === "Identifier") {
    return target.name === "setTimeout" && (resolveVariable(context, target)?.defs.length ?? 0) === 0;
  }
  return (
    target.type === "MemberExpression" &&
    !target.computed &&
    target.property.type === "Identifier" &&
    target.property.name === "setTimeout" &&
    target.object.type === "Identifier" &&
    globalObjectNames.has(target.object.name)
  );
}

function isCallOf(node: ESTree.Node | null | undefined, name: string): boolean {
  if (node === null || node === undefined) return false;
  const call = unwrapExpression(node);
  return call.type === "CallExpression" && call.callee.type === "Identifier" && call.callee.name === name;
}

/** Matches `resolve` itself or a zero-parameter function whose whole body is a call to `resolve`. */
function onlyResolves(callback: ESTree.Node | undefined, resolveName: string): boolean {
  if (callback === undefined) return false;
  if (callback.type === "Identifier") return callback.name === resolveName;
  if (!isInlineFunction(callback) || callback.params.length > 0) return false;
  const body = callback.body;
  if (body === null) return false;
  if (body.type !== "BlockStatement") return isCallOf(body, resolveName);
  const [statement] = body.body;
  if (body.body.length !== 1 || statement === undefined) return false;
  if (statement.type === "ExpressionStatement") return isCallOf(statement.expression, resolveName);
  return statement.type === "ReturnStatement" && isCallOf(statement.argument, resolveName);
}

function isTimeoutPromise(context: Context, node: ESTree.NewExpression): boolean {
  if (node.callee.type !== "Identifier" || node.callee.name !== "Promise") return false;
  const executor = node.arguments[0];
  if (!isInlineFunction(executor)) return false;
  const resolve = executor.params[0];
  if (resolve?.type !== "Identifier") return false;
  return someDescendant(
    context,
    executor,
    (candidate) =>
      candidate.type === "CallExpression" &&
      isGlobalSetTimeout(context, candidate.callee) &&
      onlyResolves(candidate.arguments[0], resolve.name),
  );
}

function isNumericSleepCall(node: ESTree.Node): boolean {
  const call = unwrapExpression(node);
  if (call.type !== "CallExpression" || call.callee.type !== "Identifier") return false;
  if (!sleepHelperNames.has(call.callee.name)) return false;
  const duration = call.arguments[0];
  return duration?.type === "Literal" && typeof duration.value === "number";
}

export const noTestSleeps: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow wall-clock sleeps in test files: setTimeout-backed promises, node:timers/promises sleeps, and awaited sleep helpers with a fixed duration.",
    },
    messages: {
      timeoutPromise:
        "This promise only waits for a timer, so the test sleeps on the wall clock: slow when the machine is fast, flaky when it is slow. Await the condition with vi.waitFor or expect.poll, or control time with vi.useFakeTimers and vi.advanceTimersByTime.",
      timersPromisesImport:
        'Importing "{{name}}" from "{{source}}" brings a wall-clock sleep into this test file. Await the condition with vi.waitFor or expect.poll, or control time with vi.useFakeTimers and vi.advanceTimersByTime.',
      sleepHelper:
        "This awaited fixed-duration sleep makes the test depend on wall-clock timing. Await the condition with vi.waitFor or expect.poll, or control time with vi.useFakeTimers and vi.advanceTimersByTime.",
    },
  },
  create(context) {
    if (!isTestFile(context as RuleContextWithFilename)) return {};

    const sleeps: {
      readonly node: ESTree.Node;
      readonly messageId: "timeoutPromise" | "sleepHelper";
    }[] = [];
    let usesFakeTimers = false;

    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (node.importKind === "type" || !timerPromiseModules.has(source)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          const name = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
          if (sleepingTimerExports.has(name)) {
            context.report({
              node: specifier,
              messageId: "timersPromisesImport",
              data: { name, source },
            });
          }
        }
      },
      CallExpression(node) {
        if (testApi(context as Context, node.callee) === "vi.useFakeTimers") usesFakeTimers = true;
      },
      NewExpression(node) {
        if (isTimeoutPromise(context as Context, node)) sleeps.push({ node, messageId: "timeoutPromise" });
      },
      AwaitExpression(node) {
        if (isNumericSleepCall(node.argument)) sleeps.push({ node, messageId: "sleepHelper" });
      },
      "Program:exit"() {
        if (usesFakeTimers) return;
        for (const sleep of sleeps) context.report(sleep);
      },
    };
  },
};
