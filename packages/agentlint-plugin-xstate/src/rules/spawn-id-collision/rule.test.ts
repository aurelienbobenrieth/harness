import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineSpawnIdCollision, spawnIdCollision } from "./rule.js";

it("reports a v6 enq.spawn with a literal id inside an event handler", async () => {
  const source = `
import { createMachine } from "xstate";

export const call = createMachine({
  actors: { participant: participantLogic },
  initial: "live",
  states: {
    live: {
      on: {
        "participant.joined": ({ context, event }, enq) => {
          const ref = enq.spawn("participant", { id: "participant", input: { id: event.id } });
          return { context: { ...context, participants: [...context.participants, ref] } };
        },
      },
    },
  },
});
`;
  const findings = await testRuleOnSource({ rule: spawnIdCollision, source: source, file: "src/call-machine.ts" });

  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [
      11,
      `Spawn with fixed id "participant" inside the 'participant.joined' handler: a repeated 'participant.joined' throws in v6 and orphans the first child in v5; derive the id per child or stop the existing child first.`,
    ],
  ]);
});

it("reports v5 spawnChild and spawn-in-assign with literal ids in transition actions, including template literals without interpolation", async () => {
  const source = `
const todos = setup({ actors: { todo: todoMachine } }).createMachine({
  on: {
    ADD: { actions: spawnChild("todo", { id: "todo" }) },
    SYNC: { actions: enqueueActions(({ enqueue }) => { enqueue.spawnChild("sync", { id: \`sync\` }); }) },
    TRACK: { actions: assign({ tracker: ({ spawn }) => spawn("tracker", { id: "tracker" }) }) },
  },
});
`;
  const findings = await testRuleOnSource({ rule: spawnIdCollision, source: source, file: "src/todos.ts" });

  expect(findings.map((finding) => finding.line)).toEqual([4, 5, 6]);
});

it("stays silent on ids derived per child, generated ids, non-literal ids, and spawns outside event handlers", async () => {
  const source = `
const machine = createMachine({
  context: ({ spawn, actors }) => ({ connection: spawn(actors.connection, { id: "connection" }) }),
  entry: (_, enq) => { enq.spawn("sync", { id: "sync" }); },
  on: {
    "file.added": ({ event }, enq) => { enq.spawn("upload", { id: \`upload-\${event.fileId}\` }); },
    "job.added": (_, enq) => { enq.spawn("job"); },
    "worker.added": ({ event }, enq) => { enq.spawn("worker", { id: event.workerId }); },
    "pool.grown": ({ context }) => { context.pool.spawn("worker", { id: "worker" }); },
  },
  states: { a: { after: { 1000: (_, enq) => { enq.spawn("ping", { id: "ping" }); } } } },
});
`;
  await expect(testRuleOnSource({ rule: spawnIdCollision, source: source, file: "src/m.ts" })).resolves.toEqual([]);
});

it("honours a configured spawnChildCallPattern", async () => {
  const rule = defineSpawnIdCollision({ spawnChildCallPattern: /^startChild\s*\(/ });
  const source =
    'createMachine({ on: { A: { actions: startChild("a", { id: "a" }) }, B: { actions: spawnChild("b", { id: "b" }) } } });';
  const findings = await testRuleOnSource({ rule: rule, source: source, file: "src/m.ts" });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain('"a"');
});
