import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/named-actor-src";

it("reports inline fromPromise as invoke.src", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ invoke: { src: fromPromise(() => load()), onDone: "ready" } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a machine reference as invoke.src inside nested states and arrays", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ states: { loading: { invoke: [{ src: "named" }, { src: childMachine }] } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inline src inside createStateConfig", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nconst s = setup({ types: {} });\nexport const loading = s.createStateConfig({ invoke: { src: fromPromise(() => load()) } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inline logic passed to spawnChild and enqueue.spawnChild", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const a = spawnChild(childMachine);\nexport const b = enqueueActions(({ enqueue }) => { enqueue.spawnChild(fromPromise(() => load())); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports spawn(machine) when checkSpawn is enabled", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const a = assign({ ref: ({ spawn }) => spawn(childMachine) });\n',
      { ruleOptions: { checkSpawn: true } },
    ),
  ).resolves.toBeUndefined();
});

it("reports inline guards when guards is enabled", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { GO: { guard: ({ context }) => context.ok, target: "next" } } });\n',
      { ruleOptions: { guards: true } },
    ),
  ).resolves.toBeUndefined();
});

it("accepts string and no-substitution template sources", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {}, actors: { loadCart: fromPromise(() => load()) } }).createMachine({ invoke: { src: "loadCart" }, states: { a: { invoke: { src: `loadCart` } } } });\nexport const a = spawnChild("loadCart");\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts identifiers bound to string constants", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nconst LOAD = "loadCart";\nexport const m = setup({ types: {} }).createMachine({ invoke: { src: LOAD } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves spawn(machine) alone by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const a = assign({ ref: ({ spawn }) => spawn(childMachine) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves inline guards alone by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { GO: { guard: ({ context }) => context.ok, target: "next" } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores invoke-shaped objects outside machine config", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const options = { invoke: { src: fromPromise(() => load()) } };\nconsole.log(setup);\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts named guards when guards is enabled", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { GO: { guard: "isOk", target: "next" } } });\n',
      { ruleOptions: { guards: true } },
    ),
  ).resolves.toBeUndefined();
});

it("reports inline invoke.src in a file that declares setup({ types }) without v5-only imports", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ invoke: { src: childMachine } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inline logic passed to the XState v6 enq.spawn", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createAsyncLogic, setup } from "xstate";\nconst s = setup({ actors: {} });\nexport const m = s.createMachine({ on: { add: (_, enq) => { enq.spawn(createAsyncLogic({ run: async () => 1 })); } } });\n',
      { message: /Inline actor logic cannot be persisted or replaced with machine\.provide\(\)/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports inline logic passed to enq.spawn inside an XState v6 createStateConfig(path, config)", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createAsyncLogic, setup } from "xstate";\nconst s = setup({ actors: {} });\nexport const loading = s.createStateConfig("loading", { entry: (_, enq) => { enq.spawn(createAsyncLogic({ run: async () => 1 })); } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inline logic spawned from an XState v6 context factory when checkSpawn is enabled", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createAsyncLogic, createMachine } from "xstate";\nexport const m = createMachine({ context: ({ spawn }) => ({ ref: spawn(createAsyncLogic({ run: async () => 1 })) }) });\n',
      { ruleOptions: { checkSpawn: true } },
    ),
  ).resolves.toBeUndefined();
});

it("accepts registered keys and logic values passed to the XState v6 enq.spawn", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createAsyncLogic, setup } from "xstate";\nconst uploadLogic = createAsyncLogic({ run: async () => 1 });\nconst s = setup({ actors: { upload: uploadLogic } });\nexport const m = s.createMachine({ on: { add: ({ actors }, enq) => { enq.spawn(uploadLogic, { id: "u" }); enq.spawn("upload"); enq.spawn(actors.upload); } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves XState v6 invoke.src logic values and inline logic alone", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createAsyncLogic, setup } from "xstate";\nconst uploadLogic = createAsyncLogic({ run: async () => 1 });\nconst s = setup({ actors: { upload: uploadLogic } });\nexport const a = s.createMachine({ invoke: { src: uploadLogic } });\nexport const b = s.createMachine({ invoke: { src: createAsyncLogic({ run: async () => 1 }) } });\nexport const c = s.createMachine({ invoke: s.createInvoke({ src: async () => 1 }) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts registered actors spawned from an XState v6 context factory when checkSpawn is enabled", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createAsyncLogic, createMachine } from "xstate";\nconst uploadLogic = createAsyncLogic({ run: async () => 1 });\nexport const m = createMachine({ actors: { upload: uploadLogic }, context: ({ spawn, actors }) => ({ ref: spawn(actors.upload), other: spawn(uploadLogic) }) });\n',
      { ruleOptions: { checkSpawn: true } },
    ),
  ).resolves.toBeUndefined();
});

it("ignores spawn on a second parameter outside XState v6 handler hosts", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createAsyncLogic } from "xstate";\nexport function run(_: unknown, pool: { spawn(task: unknown): void }) { pool.spawn(createAsyncLogic({ run: async () => 1 })); }\n',
    ),
  ).resolves.toBeUndefined();
});
