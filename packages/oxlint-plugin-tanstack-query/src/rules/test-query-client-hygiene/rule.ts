/**
 * Require test files to build an isolated, retry-free QueryClient.
 *
 * @attribution TanStack Query "Testing" guide and "Testing React Query" by Dominik Dorfmeister, tkdodo.eu (concept)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isFunctionNode, optionsObject, parentOf, unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { calleeName, findProperty, hasSpread } from "../ast.js";
import { importedQueryName } from "../binding-support.js";

const sharedClient =
  "This QueryClient is shared by every test in the file, so cached data leaks between tests and results depend on order. Create the client inside each test, a beforeEach, or a render helper, or clear it after each test.";
const retriesEnabled =
  "This test QueryClient keeps the default three retries with backoff, so error-path tests wait for seconds or time out. Set defaultOptions.queries.retry to false.";

const defaultTestFilePattern = "(?:\\.(?:test|spec)\\.[cm]?[jt]sx?$)|(?:/__tests__/)";
const suiteCallees: ReadonlySet<string> = new Set(["describe", "suite", "context"]);

function isTestFile(context: Context): boolean {
  const configured = optionsObject(context).testFilePattern;
  const pattern = typeof configured === "string" && configured.length > 0 ? configured : defaultTestFilePattern;
  return new RegExp(pattern).test((context.filename ?? "").replaceAll("\\", "/"));
}

/** Root identifier of a callee such as `describe`, `describe.only` or `describe.each(table)`. */
function calleeRoot(node: ESTree.Node): string | undefined {
  let current = node;
  for (;;) {
    if (current.type === "Identifier") return current.name;
    if (current.type === "MemberExpression") current = current.object;
    else if (current.type === "CallExpression" || current.type === "TaggedTemplateExpression")
      current = current.type === "CallExpression" ? current.callee : current.tag;
    else return undefined;
  }
}

/** True when the expression runs once per file: at module scope or directly in a suite callback. */
function isSharedAcrossTests(node: ESTree.Node): boolean {
  let current = parentOf(node);
  while (current !== undefined) {
    if (isFunctionNode(current)) {
      const call = parentOf(current);
      const isSuite =
        call?.type === "CallExpression" &&
        call.arguments.includes(current as ESTree.Expression) &&
        suiteCallees.has(calleeRoot(call.callee) ?? "");
      if (!isSuite) return false;
    }
    if (current.type === "PropertyDefinition" || current.type === "MethodDefinition") return false;
    current = parentOf(current);
  }
  return true;
}

/** True when the client held by this declaration is emptied somewhere in the file via `.clear()`. */
function isCleared(context: Context, node: ESTree.NewExpression): boolean {
  const declarator = parentOf(node);
  if (declarator?.type !== "VariableDeclarator" || declarator.id.type !== "Identifier") return false;
  const id = declarator.id;
  const variable = context.sourceCode.scopeManager
    .getDeclaredVariables(declarator)
    .find((candidate) => candidate.identifiers.some((identifier) => identifier === id));
  return (variable?.references ?? []).some((reference) => {
    let current: ESTree.Node = reference.identifier;
    for (;;) {
      const parent = parentOf(current);
      if (parent?.type === "MemberExpression" && parent.object === current) {
        const call = parentOf(parent);
        if (call?.type !== "CallExpression" || call.callee !== parent) return false;
        if (calleeName(call) === "clear") return true;
        current = call;
        continue;
      }
      return false;
    }
  });
}

type RetryState = "disabled-or-explicit" | "missing" | "unknown";

function retryState(node: ESTree.NewExpression): RetryState {
  const argument = node.arguments[0];
  if (argument === undefined) return "missing";
  if (argument.type === "SpreadElement") return "unknown";
  let current = unwrapExpressionKeepingChain(argument);
  for (const key of ["defaultOptions", "queries"]) {
    if (current.type !== "ObjectExpression") return "unknown";
    const property = findProperty(current, key);
    if (property === undefined) return hasSpread(current) ? "unknown" : "missing";
    current = unwrapExpressionKeepingChain(property.value);
  }
  if (current.type !== "ObjectExpression") return "unknown";
  if (findProperty(current, "retry") !== undefined) return "disabled-or-explicit";
  return hasSpread(current) ? "unknown" : "missing";
}

export const testQueryClientHygiene: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require test files to create a QueryClient per test and to set defaultOptions.queries.retry explicitly.",
    },
    messages: { sharedClient, retriesEnabled },
    schema: [
      {
        type: "object",
        properties: {
          testFilePattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (importedQueryName(context, node.callee) !== "QueryClient" || !isTestFile(context)) return;
        if (isSharedAcrossTests(node) && !isCleared(context, node)) context.report({ node, messageId: "sharedClient" });
        if (retryState(node) === "missing") context.report({ node, messageId: "retriesEnabled" });
      },
    };
  },
};
