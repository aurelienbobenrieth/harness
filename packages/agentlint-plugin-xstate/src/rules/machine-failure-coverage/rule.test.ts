import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode, guidanceChecks } from "../test-support.js";
import { machineFailureCoverage } from "./rule.js";

it("reports machines with invoked actors and no error handling", () => {
  const context = createContext({ filename: "assets/cart-machine.ts" });
  const visitors = createVisitors(machineFailureCoverage, context);

  visitors.call_expression?.(
    createNode(
      "call_expression",
      'createMachine({\n  states: {\n    adding: {\n      invoke: { src: "addToCart", onDone: "added" },\n    },\n  },\n})',
    ),
  );

  expect(context.messages).toHaveLength(1);
});

it("ignores machines whose invokes handle errors", () => {
  const context = createContext({ filename: "assets/cart-machine.ts" });
  const visitors = createVisitors(machineFailureCoverage, context);

  visitors.call_expression?.(
    createNode(
      "call_expression",
      'createMachine({\n  states: {\n    adding: {\n      invoke: { src: "addToCart", onDone: "added", onError: "failed" },\n    },\n  },\n})',
    ),
  );

  expect(context.messages).toEqual([]);
});

it("allows pure machines without invoked actors", () => {
  const context = createContext({ filename: "assets/toggle-machine.ts" });
  const visitors = createVisitors(machineFailureCoverage, context);

  visitors.call_expression?.(
    createNode("call_expression", 'createMachine({\n  initial: "off",\n  states: { off: {}, on: {} },\n})'),
  );

  expect(context.messages).toEqual([]);
});

it("reports chained setup().createMachine() definitions once", () => {
  const context = createContext({ filename: "assets/cart-machine.ts" });
  const visitors = createVisitors(machineFailureCoverage, context);

  const chainedText =
    'setup({ actors: { addToCart } }).createMachine({\n  states: { adding: { invoke: { src: "addToCart" } } },\n})';
  visitors.call_expression?.(createNode("call_expression", chainedText));
  visitors.call_expression?.(createNode("call_expression", "setup({ actors: { addToCart } })"));

  expect(context.messages).toHaveLength(1);
});

it("ignores unrelated calls", () => {
  const context = createContext({ filename: "assets/cart-machine.ts" });
  const visitors = createVisitors(machineFailureCoverage, context);

  visitors.call_expression?.(createNode("call_expression", "createStore({ count: 0 })"));

  expect(context.messages).toEqual([]);
});

it("reports an uncovered spawned actor even when a covered invoke exists", async () => {
  const source = `
const machine = setup({ actors: { load, sync } }).createMachine({
  entry: spawnChild("sync", { id: "sync" }),
  invoke: { src: "load", onDone: ".ready", onError: ".failed" },
});
`;
  const findings = await testRuleOnSource(machineFailureCoverage, source, "src/cart-machine.ts");

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("Spawned actor");
});

it("reports spawn inside assign and enqueue.spawnChild", async () => {
  const source = `
const machine = createMachine({
  on: {
    ADD: { actions: assign({ ref: ({ spawn }) => spawn(fromPromise(() => save())) }) },
    SYNC: { actions: enqueueActions(({ enqueue }) => { enqueue.spawnChild("sync"); }) },
  },
});
`;
  await expect(testRuleOnSource(machineFailureCoverage, source, "src/cart-machine.ts")).resolves.toHaveLength(2);
});

it("accepts spawned actors when the machine handles an xstate.error event", async () => {
  const source = `
const machine = createMachine({
  entry: spawnChild("sync", { id: "sync" }),
  on: { "xstate.error.actor.sync": { target: ".failed" } },
});
`;
  await expect(testRuleOnSource(machineFailureCoverage, source, "src/cart-machine.ts")).resolves.toEqual([]);
});

it("keeps invoke and spawn coverage independent", async () => {
  const source = `
const machine = createMachine({
  entry: spawnChild("sync", { id: "sync" }),
  on: { "xstate.error.actor.sync": { target: ".failed" } },
  invoke: { src: "load" },
});
`;
  const findings = await testRuleOnSource(machineFailureCoverage, source, "src/cart-machine.ts");

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("no onError");
});

it("reports an empty-object onError but accepts a handler with content", async () => {
  const source = `
const machine = createMachine({
  states: {
    a: { invoke: { src: "load", onError: {} } },
    b: { invoke: [{ src: "save", onError: { target: "failed" } }, { src: "track", onError: "failed" }] },
  },
});
`;
  const findings = await testRuleOnSource(machineFailureCoverage, source, "src/cart-machine.ts");

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("empty onError");
});

it("states that onError does not catch errors thrown in actions", () => {
  expect(guidanceChecks(machineFailureCoverage).join("\n")).toContain(
    "Errors thrown inside actions are not caught by onError",
  );
});
