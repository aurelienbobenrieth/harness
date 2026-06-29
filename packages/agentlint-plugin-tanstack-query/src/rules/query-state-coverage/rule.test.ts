import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { queryStateCoverage } from "./rule.js";

function createNode(text: string): AgentlintNode {
  return {
    type: "call_expression",
    text,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
    isNamed: true,
    children: [],
    parent: null,
    childCount: 0,
    childByFieldName: () => null,
    childrenByType: () => [],
    descendantsOfType: () => [],
  };
}

function createContext(): RuleContext & { readonly messages: string[] } {
  const messages: string[] = [];

  return {
    messages,
    getFilename: () => "src/page.tsx",
    getFilePath: () => "src/page.tsx",
    getSourceCode: () => "",
    getLinesAround: () => "",
    report: (options) => {
      messages.push(options.message);
    },
  };
}

it("reports useQuery calls", () => {
  const context = createContext();
  const visitors = queryStateCoverage.createOnce(context);

  visitors.call_expression?.(createNode("useQuery(userQueryOptions(userId))"));

  expect(context.messages).toEqual([
    "Review this TanStack Query usage for pending, error, empty, success, and retry-state coverage.",
  ]);
});

it("reports useInfiniteQuery calls", () => {
  const context = createContext();
  const visitors = queryStateCoverage.createOnce(context);

  visitors.call_expression?.(createNode("useInfiniteQuery(feedQueryOptions())"));

  expect(context.messages).toEqual([
    "Review this TanStack Query usage for pending, error, empty, success, and retry-state coverage.",
  ]);
});

it("reports queryOptions definitions", () => {
  const context = createContext();
  const visitors = queryStateCoverage.createOnce(context);

  visitors.call_expression?.(createNode("queryOptions({ queryKey, queryFn })"));

  expect(context.messages).toEqual([
    "Review this TanStack Query usage for pending, error, empty, success, and retry-state coverage.",
  ]);
});

it("ignores unrelated hooks", () => {
  const context = createContext();
  const visitors = queryStateCoverage.createOnce(context);

  visitors.call_expression?.(createNode("useMemo(() => value, [value])"));

  expect(context.messages).toEqual([]);
});
