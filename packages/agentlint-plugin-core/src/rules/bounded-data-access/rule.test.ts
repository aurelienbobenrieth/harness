import { createVisitors } from "../test-support.js";
import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { boundedDataAccess } from "./rule.js";

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

function createContext(filename: string): RuleContext & { readonly messages: string[] } {
  const messages: string[] = [];

  return {
    messages,
    path: filename,
    source: "",
    dependencies: {},
    absolutePath: filename,
    report: (options) => {
      messages.push(options.message);
    },
  };
}

it("reports repository findMany calls without a bound", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("userRepo.findMany({ where: { active: true } })"));

  expect(context.messages).toEqual([
    "Repository-like data access has no visible positive limit or page-size bound; verify result cardinality.",
  ]);
});

it("reports client list calls in repository-like files", () => {
  const context = createContext("src/repositories/user.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("client.users.list({ status })"));

  expect(context.messages).toEqual([
    "Repository-like data access has no visible positive limit or page-size bound; verify result cardinality.",
  ]);
});

it("allows calls with an explicit limit", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("userRepo.findMany({ where: { active: true }, limit: 50 })"));

  expect(context.messages).toEqual([]);
});

it("allows cursor-based calls", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("userRepo.list({ cursor, pageSize: 100 })"));

  expect(context.messages).toEqual([]);
});

it("reviews ID filters without a cardinality bound", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("userRepo.findMany({ where: { id: userId } })"));

  expect(context.messages).toHaveLength(1);
});

it("ignores non-data-access list calls", () => {
  const context = createContext("src/format.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("items.list()"));

  expect(context.messages).toEqual([]);
});
