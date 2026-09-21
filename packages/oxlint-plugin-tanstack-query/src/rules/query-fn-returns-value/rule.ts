/**
 * Require query functions to return data. Syntactic stand-in for the type-aware
 * official rule, which cannot run without a TypeScript program.
 *
 * @attribution @tanstack/eslint-plugin-query no-void-query-fn (concept)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { unwrapExpression, walkOwnBody } from "../ast.js";
import { queryFunction, queryFunctionNames } from "../query-function.js";

const noReturn =
  "This queryFn never returns a value, so the query resolves to undefined, which TanStack Query rejects as data. Return the fetched data.";
const emptyReturn =
  "This queryFn path returns undefined, which TanStack Query rejects as data. Return the data, return null for an intentional empty result, or throw.";

function isUndefinedValue(argument: ESTree.Node | null): boolean {
  if (argument === null) return true;
  const expression = unwrapExpression(argument);
  if (expression.type === "Identifier") return expression.name === "undefined";
  return expression.type === "UnaryExpression" && expression.operator === "void";
}

export const queryFnReturnsValue: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require block-bodied queryFn functions to return a value: no missing return, bare return, or return undefined.",
    },
    messages: { noReturn, emptyReturn },
    schema: [],
  },
  createOnce(context) {
    return {
      Property(node) {
        const fn = queryFunction(context, node, queryFunctionNames);
        if (fn === undefined || fn.body?.type !== "BlockStatement") return;
        if ((fn as { readonly generator?: boolean }).generator === true) return;
        let valued = 0;
        const empty: ESTree.Node[] = [];
        walkOwnBody(fn, (candidate) => {
          if (candidate.type !== "ReturnStatement") return;
          if (isUndefinedValue(candidate.argument)) empty.push(candidate);
          else valued += 1;
        });
        for (const statement of empty) context.report({ node: statement, messageId: "emptyReturn" });
        if (valued > 0 || empty.length > 0) return;
        if (fn.body.body.at(-1)?.type === "ThrowStatement") return;
        context.report({ node: node.key, messageId: "noReturn" });
      },
    };
  },
};
