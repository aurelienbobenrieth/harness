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
  const findings = await testRuleOnSource({
    rule: machineFailureCoverage,
    source: source,
    file: "src/cart-machine.ts",
  });

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
  await expect(
    testRuleOnSource({ rule: machineFailureCoverage, source: source, file: "src/cart-machine.ts" }),
  ).resolves.toHaveLength(2);
});

it("accepts spawned actors when the machine handles an xstate.error event", async () => {
  const source = `
const machine = createMachine({
  entry: spawnChild("sync", { id: "sync" }),
  on: { "xstate.error.actor.sync": { target: ".failed" } },
});
`;
  await expect(
    testRuleOnSource({ rule: machineFailureCoverage, source: source, file: "src/cart-machine.ts" }),
  ).resolves.toEqual([]);
});

it("keeps invoke and spawn coverage independent", async () => {
  const source = `
const machine = createMachine({
  entry: spawnChild("sync", { id: "sync" }),
  on: { "xstate.error.actor.sync": { target: ".failed" } },
  invoke: { src: "load" },
});
`;
  const findings = await testRuleOnSource({
    rule: machineFailureCoverage,
    source: source,
    file: "src/cart-machine.ts",
  });

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
  const findings = await testRuleOnSource({
    rule: machineFailureCoverage,
    source: source,
    file: "src/cart-machine.ts",
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("empty onError");
});

it("states the action-error contract per version: v5 bypasses onError, v6 recovers in the nearest state", () => {
  const checks = guidanceChecks(machineFailureCoverage).join("\n");

  expect(checks).toContain("v5: an error thrown inside an action is not caught by onError");
  expect(checks).toContain(
    "v6: an error thrown in a transition function or an enq(...) effect goes to the nearest active state's onError",
  );
  expect(checks).not.toContain("onError never covers");
});

const v6UploadMachine = `
import { createAsyncLogic, setup } from "xstate";

const s = setup({ actors: { upload: createAsyncLogic({ run: async ({ input, signal }) => send(input, signal) }) } });

export const uploadMachine = s.createMachine({
  initial: "idle",
  states: {
    idle: { on: { pick: { target: "checking" } } },
    checking: {
      invoke: s.createInvoke({
        src: async ({ signal }) => check(signal),
        onDone: { target: "uploading" },
      }),
    },
    uploading: {
      onError: { target: "failed" },
      invoke: { src: "upload", onDone: { target: "done" } },
    },
    failed: { on: { retry: { target: "uploading" } } },
    done: { type: "final" },
  },
});
`;

it("reports a v6 createInvoke without onError and accepts an invoke covered by its state's onError", async () => {
  const findings = await testRuleOnSource({
    rule: machineFailureCoverage,
    source: v6UploadMachine,
    file: "src/upload-machine.ts",
  });

  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [
      11,
      "Invoked actor has no onError (on the invoke, or in v6 on an enclosing state): verify its failure and recovery contract.",
    ],
  ]);
});

it("does not let an onError inside a sibling invoke or an empty state onError cover an invoke", async () => {
  const source = `
const machine = createMachine({
  states: {
    a: {
      onError: {},
      invoke: [{ src: "load", onError: { target: "failed" } }, { src: "track" }],
    },
  },
});
`;
  const findings = await testRuleOnSource({ rule: machineFailureCoverage, source: source, file: "src/m.ts" });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("no onError");
});

it("reports v6 spawns until a root onError, an xstate.error.actor transition or a subscribeTo error mapper covers them", async () => {
  const uncovered = `
const machine = createMachine({
  actors: { upload },
  context: ({ spawn, actors }) => ({ connection: spawn(actors.connection, { id: "connection" }) }),
  on: {
    "file.added": ({ context, event }, enq) => {
      const ref = enq.spawn("upload", { id: \`upload-\${event.fileId}\` });
      return { context: { ...context, uploads: [...context.uploads, ref] } };
    },
  },
  states: { busy: { onError: { target: "failed" } } },
});
`;
  const findings = await testRuleOnSource({ rule: machineFailureCoverage, source: uncovered, file: "src/m.ts" });
  expect(findings.map((finding) => finding.line)).toEqual([4, 7]);

  const covered = [
    uncovered.replace("actors: { upload },", 'actors: { upload },\n  onError: { target: ".failed" },'),
    uncovered.replace(
      "on: {",
      'on: {\n    "xstate.error.actor": { matches: { actorId: "connection" }, target: ".failed" },',
    ),
    uncovered.replace(
      "return { context",
      'enq.subscribeTo(ref, { error: (error) => ({ type: "upload.failed", error }) });\n      return { context',
    ),
  ];
  const coveredFindings = await Promise.all(
    covered.map((source) => testRuleOnSource({ rule: machineFailureCoverage, source: source, file: "src/m.ts" })),
  );
  expect(coveredFindings).toEqual([[], [], []]);
});

it("treats fromEffect logic as a failure-capable source", async () => {
  const source =
    'const machine = setupEffect({ actors: { deploy: fromEffect(deployEffect) } }).createMachine({ initial: "idle" });';

  await expect(
    testRuleOnSource({ rule: machineFailureCoverage, source: source, file: "src/deploy.ts" }),
  ).resolves.toHaveLength(1);
});
