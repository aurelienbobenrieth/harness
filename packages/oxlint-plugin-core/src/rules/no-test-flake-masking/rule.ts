/**
 * @attribution landmines by Interfere (MIT, concept re-implemented)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isInlineFunction } from "../ast-support.js";
import { getFilename, isTestFile, type RuleContextWithFilename } from "../filename-support.js";
import { testApi } from "../test-api-support.js";

const registrations = new Set(["it", "test", "describe", "suite"]);
const hooks = new Set(["beforeAll", "beforeEach", "afterAll", "afterEach"]);
const configFilePattern = /(?:^|\/)vit(?:e|est)\.(?:config|workspace)\.[cm]?[jt]s$/u;

function keyName(property: ESTree.Node): string | undefined {
  if (property.type !== "Property" || property.computed) return undefined;
  if (property.key.type === "Identifier") return property.key.name;

  return property.key.type === "Literal" ? String(property.key.value) : undefined;
}

/** `retry: 0` switches retries off, so only a value other than the literal 0 masks a flake. */
function retries(property: ESTree.Node): boolean {
  if (property.type !== "Property" || keyName(property) !== "retry") return false;

  return !(property.value.type === "Literal" && property.value.value === 0);
}

/** Walks `test.each(rows)`, `it.effect`, `describe.skipIf(ci)` and tagged forms down to the test API they extend. */
function registrationName(context: Context, callee: ESTree.Node): string | undefined {
  let current: ESTree.Node = callee;

  for (;;) {
    const name = testApi(context, current);

    if (name !== undefined) return name;
    if (current.type === "MemberExpression") current = current.object;
    else if (current.type === "CallExpression") current = current.callee;
    else if (current.type === "TaggedTemplateExpression") current = current.tag;
    else return undefined;
  }
}

export const noTestFlakeMasking: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow masking flaky tests: retries on tests, suites, vi.setConfig and the Vitest config, and timeouts raised on a single test, suite or hook.",
    },
    messages: {
      retry:
        "A retry makes a flaky test pass on rerun while the race stays. Remove the retry and make the test await the event it depends on.",
      timeout:
        "A timeout on one test, suite or hook hides a slow or racing test. Remove it and await the event the test depends on; a suite slow everywhere gets testTimeout in the Vitest config.",
    },
  },
  create(context) {
    const inTestFile = isTestFile(context as RuleContextWithFilename);
    const inConfigFile = configFilePattern.test(getFilename(context as RuleContextWithFilename));

    function reportOptions(options: ESTree.Node | undefined, timeoutKeys: ReadonlySet<string>): void {
      if (options?.type !== "ObjectExpression") return;

      for (const property of options.properties) {
        if (retries(property)) context.report({ node: property, messageId: "retry" });
        const key = keyName(property);

        if (key !== undefined && timeoutKeys.has(key)) context.report({ node: property, messageId: "timeout" });
      }
    }

    return {
      CallExpression(node) {
        if (testApi(context as Context, node.callee) === "vi.setConfig") {
          reportOptions(node.arguments[0], new Set(["testTimeout", "hookTimeout"]));

          return;
        }

        if (!inTestFile) return;
        const name = registrationName(context as Context, node.callee);

        if (name !== undefined && hooks.has(name)) {
          const [callback, timeout] = node.arguments;

          if (isInlineFunction(callback) && timeout !== undefined)
            context.report({ node: timeout, messageId: "timeout" });

          return;
        }

        if (name === undefined || !registrations.has(name)) return;
        const [, second, third] = node.arguments;

        reportOptions(second, new Set(["timeout"]));
        reportOptions(third, new Set(["timeout"]));

        if (isInlineFunction(second) && third !== undefined && third.type !== "ObjectExpression") {
          context.report({ node: third, messageId: "timeout" });
        }
      },
      Property(node) {
        if (!inConfigFile || keyName(node) !== "test" || node.value.type !== "ObjectExpression") return;

        for (const property of node.value.properties) {
          if (retries(property)) context.report({ node: property, messageId: "retry" });
        }
      },
    };
  },
};
