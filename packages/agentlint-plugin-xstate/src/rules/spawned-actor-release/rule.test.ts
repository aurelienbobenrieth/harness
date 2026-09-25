import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineSpawnedActorRelease, spawnedActorRelease } from "./rule.js";

const todosMachine = `
const todos = setup({ actors: { todo: todoMachine } }).createMachine({
  context: { todos: [] },
  on: {
    ADD: { actions: assign({ todos: ({ context, spawn }) => [...context.todos, spawn("todo")] }) },
    REMOVE: { actions: assign({ todos: ({ context, event }) => context.todos.filter((t) => t.id !== event.id) }) },
  },
});
`;

it("reports a machine that spawns inside assign, once for the chained setup().createMachine()", async () => {
  const findings = await testRuleOnSource({
    rule: spawnedActorRelease,
    source: todosMachine,
    file: "src/todos-machine.ts",
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("stopChild()");
});

it("reports spawnChild and enqueue.spawnChild", async () => {
  const bare = 'createMachine({ entry: spawnChild("sync", { id: "sync" }) });';
  const enqueued =
    'createMachine({ entry: enqueueActions(({ enqueue }) => { enqueue.spawnChild("sync", { id: "sync" }); }) });';

  await expect(testRuleOnSource({ rule: spawnedActorRelease, source: bare, file: "src/m.ts" })).resolves.toHaveLength(
    1,
  );
  await expect(
    testRuleOnSource({ rule: spawnedActorRelease, source: enqueued, file: "src/m.ts" }),
  ).resolves.toHaveLength(1);
});

it("reports a stored setup() whose actions spawn, separately from its createMachine call", async () => {
  const source = `
const machineSetup = setup({ actions: { startSync: spawnChild("sync", { id: "sync" }) } });
const machine = machineSetup.createMachine({ entry: "startSync" });
`;
  await expect(testRuleOnSource({ rule: spawnedActorRelease, source: source, file: "src/m.ts" })).resolves.toHaveLength(
    1,
  );
});

it("reports each spawning machine definition of a file once", async () => {
  const source = `
const a = createMachine({ entry: spawnChild("one") });
const b = createMachine({ entry: spawnChild("two") });
const c = createMachine({ invoke: { src: "three", onError: "failed" } });
`;
  await expect(testRuleOnSource({ rule: spawnedActorRelease, source: source, file: "src/m.ts" })).resolves.toHaveLength(
    2,
  );
});

it("stays silent on machines that only invoke", async () => {
  const source = 'setup({}).createMachine({ invoke: { src: "load", onDone: "ready", onError: "failed" } });';

  await expect(testRuleOnSource({ rule: spawnedActorRelease, source: source, file: "src/m.ts" })).resolves.toEqual([]);
});

it("stays silent on child_process-style spawn and on spawn mentioned outside assign", async () => {
  const source = `
const child = spawn("git", ["status"]);
const machine = createMachine({ on: { RUN: { actions: ({ context }) => context.runner.spawn("job") } } });
`;
  await expect(testRuleOnSource({ rule: spawnedActorRelease, source: source, file: "src/m.ts" })).resolves.toEqual([]);
});

it("excludes test files by default and honours a configured machineCalleePattern", async () => {
  expect(spawnedActorRelease.binding.exclude).toContain("**/*.{test,spec}.*");

  const rule = defineSpawnedActorRelease({ machineCalleePattern: /^defineMachine$/ });
  const source = 'defineMachine({ entry: spawnChild("sync") }); createMachine({ entry: spawnChild("sync") });';
  const findings = await testRuleOnSource({ rule: rule, source: source, file: "src/m.ts" });

  expect(findings).toHaveLength(1);
});
