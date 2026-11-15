import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/no-context-mutation";

it("reports push on context inside an inline action", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { ADD: { actions: ({ context, event }) => { context.items.push(event.item); } } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation inside an assign updater", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const a = assign(({ context, event }) => { context.items.push(event.item); return context; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports property assignment on a renamed context binding", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const a = assign(({ context: ctx }) => { ctx.user.name = "x"; return ctx; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports update expressions", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const a = enqueueActions(({ context }) => { context.count++; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports delete on context", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const s = setup({ types: {}, actions: { drop: ({ context }) => { delete context.cache.key; } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports Map and Set mutators by default", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const a = assign(({ context }) => { context.seen.add(1); return {}; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation through snapshot.context", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createActor } from "xstate";\nconst actor = createActor(machine);\nactor.getSnapshot().context.items.push(1);\nconst snapshot = actor.getSnapshot();\nsnapshot.context.count = 2;\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts Map and Set mutators when allowCollectionMethods is set", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const a = assign(({ context }) => { context.seen.add(1); return {}; });\n',
      { ruleOptions: { allowCollectionMethods: true } },
    ),
  ).resolves.toBeUndefined();
});

it("accepts copies before mutation and immutable updates", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const a = assign({ items: ({ context, event }) => [...context.items, event.item], sorted: ({ context }) => [...context.items].sort() });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores functions that destructure context outside XState hosts", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport function handler({ context }: { context: { items: number[] } }) { context.items.push(1); }\nconsole.log(assign);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores files that do not import xstate", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export const a = assign(({ context }) => { context.items.push(1); return context; });\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores non-mutating reads and rebinding a local", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, setup } from "xstate";\nexport const a = assign(({ context }) => { let count = context.count; count += 1; const names = context.items.map((item) => item.name); return { count, names }; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports push on context inside an XState v6 transition function", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine } from "xstate";\nexport const m = createMachine({ context: { items: [] as number[] }, on: { add: ({ context }) => { context.items.push(1); } } });\n',
      { message: /as a \{ context \} patch from the handler in XState v6/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation inside an XState v6 createLogic run", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createLogic } from "xstate";\nexport const counter = createLogic({ context: { count: 0 }, run: ({ context }) => { context.count++; } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation in the config of an XState v6 createStateConfig(path, config)", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nconst s = setup({ actors: {} });\nexport const loading = s.createStateConfig("loading", { entry: ({ context }) => { delete context.cache; } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation in an XState v6 createInvoke input mapper", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nconst s = setup({ actors: {} });\nexport const invoke = s.createInvoke({ src: async () => 1, input: ({ context }) => { context.calls += 1; return {}; } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation inside an @xstate/effect setupEffect action", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setupEffect } from "@xstate/effect";\nimport { Effect } from "effect";\nexport const s = setupEffect({ actions: { track: ({ context }) => Effect.sync(() => { context.seen.add(1); }) } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation inside machine.provide implementations", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createActor } from "xstate";\nexport const actor = createActor(machine.provide({ actions: { bump: ({ context }) => { context.count++; } } }));\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts XState v6 context patches", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createLogic, createMachine } from "xstate";\nexport const m = createMachine({ context: { items: [] as number[] }, on: { add: ({ context }) => ({ context: { items: [...context.items, 1] } }) } });\nexport const counter = createLogic({ context: { count: 0 }, run: ({ context }) => ({ context: { count: context.count + 1 } }) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores context-shaped parameters in calls named like hosts from other modules", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createActor } from "xstate";\nimport { setupEffect } from "./local.js";\nimport { createLogic } from "./logic.js";\nconsole.log(createActor);\nexport const a = setupEffect({ run: ({ context }) => { context.items.push(1); } });\nexport const b = createLogic({ run: ({ context }) => { context.items.push(1); } });\n',
    ),
  ).resolves.toBeUndefined();
});
