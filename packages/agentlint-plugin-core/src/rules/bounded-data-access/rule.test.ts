import { createVisitors } from "../test-support.js";
import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { boundedDataAccess } from "./rule.js";

const unboundedMessage =
  "Repository-like data access has no caller-supplied limit or page size, and a hard-coded bound hides pagination inside the implementation. Expose limit and cursor in the function's contract and pass them here.";

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

  expect(context.messages).toEqual([unboundedMessage]);
});

it("reports client list calls in repository-like files", () => {
  const context = createContext("src/repositories/user.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("client.users.list({ status })"));

  expect(context.messages).toEqual([unboundedMessage]);
});

it("allows calls whose limit comes from a parameter", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("userRepo.findMany({ where: { active: true }, limit })"));
  visitors.call_expression?.(createNode("userRepo.findMany({ where: { active: true }, take: input.limit })"));
  visitors.call_expression?.(createNode("userRepo.list({ cursor, pageSize: options.pageSize })"));

  expect(context.messages).toEqual([]);
});

it("reports a hard-coded literal limit or take", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("userRepo.findMany({ where: { active: true }, limit: 50 })"));
  visitors.call_expression?.(createNode("client.users.findMany({ take: 10 })"));
  visitors.call_expression?.(createNode("userRepo.list({ cursor, pageSize: 100 })"));

  expect(context.messages).toEqual([unboundedMessage, unboundedMessage, unboundedMessage]);
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

it("reports only the call whose callee is the unbounded method, not an enclosing wrapper", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("Layer.effect(Tag, Effect.gen(function* () { return userRepo.list(); }))"));

  expect(context.messages).toEqual([]);
});

it("accepts a SQL LIMIT taken from a placeholder or interpolation", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("client.query(`select id from users limit ${pageSize}`)"));
  visitors.call_expression?.(createNode("client.query(`SELECT id FROM users LIMIT ?`, [limit])"));
  visitors.call_expression?.(createNode("client.query('SELECT id FROM users LIMIT $1', [limit])"));
  visitors.call_expression?.(createNode("client.query('SELECT id FROM users LIMIT :limit', { limit })"));

  expect(context.messages).toEqual([]);
});

it("reports a SQL query with a literal LIMIT, no LIMIT, or LIMIT ALL", () => {
  const context = createContext("src/userRepo.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("client.query(`SELECT id FROM users ORDER BY id LIMIT 100`)"));
  visitors.call_expression?.(createNode("client.query(`SELECT id FROM users`)"));
  visitors.call_expression?.(createNode("client.query(`SELECT id FROM users LIMIT ALL`)"));

  expect(context.messages).toHaveLength(3);
});

it("treats a client's non-SQL query call (RPC, DOM, tRPC procedure) as a call, not a data query", () => {
  const context = createContext("src/ops/queries.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode('OpsClient.query("leads.list", search, { timeToLive })'));
  visitors.call_expression?.(createNode("ctx.client.hello.query()"));
  visitors.call_expression?.(createNode("clientElement.query(By.css('#count'))"));

  expect(context.messages).toEqual([]);
});

it("skips a state store's selector call but still reports a repository select", () => {
  const context = createContext("src/store.ts");
  const visitors = createVisitors(boundedDataAccess, context);

  visitors.call_expression?.(createNode("store.select((state) => state.user.name)"));
  visitors.call_expression?.(createNode("store.select(selectUser)"));

  expect(context.messages).toHaveLength(1);
});

it("keeps test files out of scope", () => {
  expect(boundedDataAccess.binding.exclude).toEqual(
    expect.arrayContaining(["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"]),
  );
});
