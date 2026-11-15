import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "xstate/no-deferred-enqueue";

it("reports enq used in a setTimeout callback", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { createMachine } from "xstate";
export const machine = createMachine({
  initial: "idle",
  states: { idle: { entry: (_, enq) => { setTimeout(() => enq.raise({ type: "TICK" }), 1000); } } },
});
`,
      { message: /this call runs later \(in a setTimeout callback\)/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports promise, listener, and enqueued-effect callbacks", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { setup } from "xstate";
export const machine = setup({}).createMachine({
  initial: "idle",
  states: {
    idle: {
      on: {
        LOAD: ({ event }, enq) => {
          fetch(event.url).then(() => enq.raise({ type: "LOADED" }));
          window.addEventListener("online", () => enq.emit({ type: "online" }));
          enq(() => { enq.raise({ type: "LATE" }); });
          return { target: "loading" };
        },
      },
    },
    loading: {},
  },
});
`,
  );
  expect(messages.map((text) => /\(([^)]*)\)/.exec(text)?.[1])).toEqual([
    "in a .then callback",
    "in an event listener",
    "inside an enqueued effect",
  ]);
});

it("reports enq after an await in an async handler", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { createMachine } from "xstate";
export const machine = createMachine({
  initial: "idle",
  states: { idle: { on: { SAVE: { to: async ({ event }, enq) => { await event.save(); enq.raise({ type: "SAVED" }); } } } } },
});
`,
      { message: /\(after an await\)/ },
    ),
  ).resolves.toBeUndefined();
});

it("accepts synchronous enq calls, including in synchronous callbacks", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createMachine } from "xstate";
export const machine = createMachine({
  initial: "idle",
  states: {
    idle: {
      entry: ({ context }, enq) => {
        enq.raise({ type: "TICK" }, { delay: 1000 });
        context.ids.forEach((id: string) => enq.sendTo(id, { type: "PING" }));
        enq(() => setTimeout(() => console.log("tick"), 10));
      },
      on: { GO: async (_, enq) => { enq.raise({ type: "EARLY" }); await Promise.resolve(); } },
    },
  },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores createAsyncLogic run, whose enq stays valid across awaits", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createAsyncLogic } from "xstate";
export const upload = createAsyncLogic({
  run: async ({ input }: { input: { file: Blob } }, enq) => {
    const body = await input.file.text();
    enq.emit({ type: "progress", size: body.length });
    return body;
  },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores functions outside machine config", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createMachine } from "./local.js";
export const machine = createMachine({ states: { idle: { entry: (_: unknown, enq: any) => { setTimeout(() => enq.raise({ type: "TICK" })); } } } });
export const handlers = { entry: (_: unknown, enq: any) => { setTimeout(() => enq.raise({ type: "TICK" })); } };
`,
    ),
  ).resolves.toBeUndefined();
});
