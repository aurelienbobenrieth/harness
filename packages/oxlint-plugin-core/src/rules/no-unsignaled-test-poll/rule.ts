/**
 * @attribution landmines by Interfere (MIT, concept re-implemented)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isInlineFunction, unwrapExpression } from "../ast-support.js";
import { isTestFile, type RuleContextWithFilename } from "../filename-support.js";
import { testApi } from "../test-api-support.js";

/** Spy matchers (`toHaveBeenCalled*`, `toHave*Returned*`, `toHave*Resolved*`, legacy `toBeCalled*`) and `toHaveLength`. */
const recorderMatcherPattern = /^(?:toHaveBeen|toBeCalled|toHave(?:Last|Nth)?(?:Returned|Resolved)|toHaveLength$)/u;

/** The member names of a call-free path such as `app.attempts.length`, or undefined when it reads through a call. */
function pathNames(node: ESTree.Node): readonly string[] | undefined {
  const current = unwrapExpression(node);

  if (current.type === "Identifier") return [current.name];
  if (current.type !== "MemberExpression") return undefined;
  const object = pathNames(current.object);

  if (object === undefined) return undefined;

  return [...object, !current.computed && current.property.type === "Identifier" ? current.property.name : "[]"];
}

/**
 * A value that only grows as calls are recorded: a spy's `mock` state or the length or size of a collection held on
 * an object. `result.current` (a rendered hook's latest value) is observable state, not a recorder.
 */
function isRecorder(value: ESTree.Node, matcher: string | undefined): boolean {
  const names = pathNames(value);

  if (names === undefined || names.includes("current")) return false;
  if (matcher !== undefined && recorderMatcherPattern.test(matcher)) return true;
  const last = names.at(-1);

  return names.includes("mock") || (names.length > 1 && (last === "length" || last === "size"));
}

/** The expression a polled callback evaluates, when its body is that single expression. */
function polledExpression(callback: ESTree.Node | undefined): ESTree.Node | undefined {
  if (!isInlineFunction(callback) || callback.body === null) return undefined;
  if (callback.body.type !== "BlockStatement") return callback.body;
  const [statement, ...rest] = callback.body.body;

  if (rest.length > 0) return undefined;
  if (statement?.type === "ReturnStatement") return statement.argument ?? undefined;

  return statement?.type === "ExpressionStatement" ? statement.expression : undefined;
}

/** The matcher chained on `expect.poll(...)`, past any `.not`. */
function pollMatcher(poll: ESTree.Node): string | undefined {
  let member = poll.parent;

  while (member?.type === "MemberExpression" && member.property.type === "Identifier") {
    if (member.property.name !== "not") return member.property.name;
    member = member.parent;
  }

  return undefined;
}

/** `expect(value).matcher(...)` (also through `.not`) inside a `vi.waitFor` callback: the value and its matcher. */
function waitedAssertion(
  context: Context,
  node: ESTree.Node,
): { readonly value: ESTree.Node; readonly matcher: string } | undefined {
  const call = unwrapExpression(node);

  if (call.type !== "CallExpression" || call.callee.type !== "MemberExpression") return undefined;
  if (call.callee.computed || call.callee.property.type !== "Identifier") return undefined;
  let subject = unwrapExpression(call.callee.object);

  while (subject.type === "MemberExpression") subject = unwrapExpression(subject.object);
  if (subject.type !== "CallExpression" || testApi(context, subject.callee) !== "expect") return undefined;
  const [value] = subject.arguments;

  if (value === undefined || value.type === "SpreadElement") return undefined;

  return { value, matcher: call.callee.property.name };
}

export const noUnsignaledTestPoll: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow expect.poll and vi.waitFor in test files that wait on a spy or on the length or size of a recorded collection instead of a signal.",
    },
    messages: {
      poll: "Polling a spy or a recorded-call count races a deadline: it fails under CPU load, and a longer timeout only hides that. Await a signal instead: resolve a Promise.withResolvers() deferred (an Effect Deferred or Queue) where the call is recorded, or await the operation's own completion.",
    },
  },
  create(context) {
    if (!isTestFile(context as RuleContextWithFilename)) return {};

    return {
      CallExpression(node) {
        const callee = node.callee;

        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "poll" &&
          testApi(context as Context, callee.object) === "expect"
        ) {
          const value = polledExpression(node.arguments[0]);

          if (value !== undefined && isRecorder(value, pollMatcher(node))) {
            context.report({ node, messageId: "poll" });
          }

          return;
        }

        if (testApi(context as Context, callee) !== "vi.waitFor") return;
        const expression = polledExpression(node.arguments[0]);
        const assertion = expression && waitedAssertion(context as Context, expression);

        if (assertion !== undefined && isRecorder(assertion.value, assertion.matcher)) {
          context.report({ node, messageId: "poll" });
        }
      },
    };
  },
};
