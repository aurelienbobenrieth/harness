import type { ESTree, Rule } from "@oxlint/plugins";
import { effectMethod } from "../binding-support.js";
import { getFilename, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";
import { isFunctionNode, optionsObject, parentOf, stringArrayOption } from "../sota-support.js";

const message =
  "Write this test with it.effect from @effect/vitest and yield the program instead of calling Effect.{{method}}: it.effect injects TestClock and TestContext, closes scopes, and renders the failure Cause.";

const defaultTestFiles: readonly string[] = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"];
const runners: ReadonlySet<string> = new Set(["runPromise", "runPromiseExit", "runSync", "runSyncExit"]);
const testFunctions: ReadonlySet<string> = new Set(["it", "test"]);
const effectAwareModifiers: ReadonlySet<string> = new Set(["effect", "layer", "live", "scoped", "scopedLive"]);

type TestCallee = {
  readonly root: string;
  readonly modifiers: readonly string[];
};

function testCallee(node: ESTree.Node): TestCallee | undefined {
  const modifiers: string[] = [];
  let current = node;
  for (;;) {
    if (current.type === "CallExpression") {
      current = current.callee;
    } else if (current.type === "MemberExpression" && !current.computed && current.property.type === "Identifier") {
      modifiers.push(current.property.name);
      current = current.object;
    } else {
      break;
    }
  }
  return current.type === "Identifier" ? { root: current.name, modifiers } : undefined;
}

function enclosingPlainTest(node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  let current = parentOf(node);
  while (current !== undefined) {
    if (current.type === "CallExpression" && isFunctionNode(child) && current.arguments.includes(child as never)) {
      const callee = testCallee(current.callee);
      if (callee !== undefined && testFunctions.has(callee.root)) {
        return !callee.modifiers.some((modifier) => effectAwareModifiers.has(modifier));
      }
    }
    child = current;
    current = parentOf(current);
  }
  return false;
}

/** Prefer the Effect-aware test harness over running Effects by hand inside plain test callbacks. */
export const preferItEffect: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer it.effect from @effect/vitest over Effect.runPromise or Effect.runSync inside plain it/test callbacks in test files (opt-in; requires @effect/vitest).",
    },
    messages: { preferItEffect: message },
    schema: [
      {
        type: "object",
        properties: { testFiles: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ testFiles: [...defaultTestFiles] }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const method = effectMethod(context, node.callee);
        if (method === undefined || !runners.has(method)) return;

        const testFiles = stringArrayOption(optionsObject(context), "testFiles", defaultTestFiles);
        if (!isAllowedFile(getFilename(context as RuleContextWithOptions), testFiles)) return;
        if (!enclosingPlainTest(node)) return;

        context.report({ node, messageId: "preferItEffect", data: { method } });
      },
    };
  },
};
