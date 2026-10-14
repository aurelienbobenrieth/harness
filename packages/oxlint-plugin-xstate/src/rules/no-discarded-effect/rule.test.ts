import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "xstate/no-discarded-effect";

it("reports an Effect built inside an inline enq effect", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { Effect } from "effect";
import { setupEffect } from "@xstate/effect";
export const machine = setupEffect({}).createMachine({
  initial: "idle",
  states: { idle: { on: { SAVE: ({ event }, enq) => { enq(() => Effect.log("saved", event)); return { target: "saved" }; } } }, saved: {} },
});
`,
      { message: /enq\(\(\) => Effect\.\.\.\) builds an Effect that XState discards/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports piped Effects, block-bodied effects, and effect/Effect namespace imports", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import * as Effect from "effect/Effect";
import { createMachine } from "xstate";
export const machine = createMachine({
  initial: "idle",
  states: {
    idle: {
      entry: (_, enq) => {
        enq(() => Effect.sync(() => 1).pipe(Effect.tap(Effect.log)));
        enq(function () { return Effect.void; });
      },
    },
  },
});
`,
  );
  expect(messages).toHaveLength(2);
});

it("reports an Effect returned from entry, exit, and transition handlers", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { Effect } from "effect";
import { setupEffect } from "@xstate/effect";
const s = setupEffect({});
export const idle = s.createStateConfig({
  entry: () => Effect.log("entered"),
  exit() { return Effect.log("left"); },
  on: { PING: { to: () => Effect.log("ping") }, POKE: () => Effect.log("poke") },
  after: { 1000: () => Effect.log("late") },
});
`,
  );
  expect(messages).toHaveLength(5);
  expect(messages[0]).toMatch(/A machine handler returns its transition result, not work to run/);
});

it("accepts enqueued named Effect actions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { Effect } from "effect";
import { setupEffect } from "@xstate/effect";
export const machine = setupEffect({ actions: { audit: (_args: unknown) => Effect.log("audit") } }).createMachine({
  initial: "pending",
  states: { pending: { on: { APPROVE: (args, enq) => { enq(args.actions.audit, args); return { target: "approved" }; } } }, approved: {} },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts Effects that are run, non-Effect inline effects, and Effects outside handlers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { Effect } from "effect";
import { createMachine } from "xstate";
import { fromEffect } from "@xstate/effect";
const program = Effect.log("run");
export const worker = fromEffect(() => Effect.succeed(1));
export const machine = createMachine({
  actions: { notify: (_params: { msg: string }) => Effect.log("named") },
  initial: "idle",
  states: {
    idle: {
      entry: (_, enq) => {
        enq(() => Effect.runFork(program));
        enq(() => Effect.log("piped").pipe(Effect.runPromise));
        enq(() => console.log("plain"));
      },
      on: { GO: () => ({ target: "done" }) },
    },
    done: {},
  },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores an Effect namespace not imported from effect and enq-like calls outside handlers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { Effect } from "./effect-shim.js";
import { Effect as RealEffect } from "effect";
import { createMachine } from "xstate";
export const machine = createMachine({ initial: "idle", states: { idle: { entry: (_, enq) => { enq(() => Effect.log("shim")); } } } });
export function helper(_: unknown, enq: (fn: () => unknown) => void) { enq(() => RealEffect.log("outside")); }
`,
    ),
  ).resolves.toBeUndefined();
});
