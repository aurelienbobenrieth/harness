import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "xstate/no-direct-named-action";

it("reports a named action called directly from destructured args", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { createMachine } from "xstate";
export const machine = createMachine({
  actions: { notify: (params: { msg: string }) => console.log(params.msg) },
  initial: "cart",
  states: {
    cart: { on: { checkout: ({ actions }) => { actions.notify({ msg: "Charging" }); return { target: "charging" }; } } },
    charging: {},
  },
});
`,
      {
        message:
          /actions\.notify\(\) runs the side effect while XState computes the transition.*enq\(actions\.notify, params\)/,
      },
    ),
  ).resolves.toBeUndefined();
});

it("reports args.actions, renamed destructuring, and body destructuring", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { setup } from "xstate";
const s = setup({ actions: { track: (key: string) => console.log(key) } });
export const machine = s.createMachine({
  initial: "idle",
  states: {
    idle: {
      entry: (args) => { args.actions.track("entered"); },
      exit: ({ actions: named }) => { named.track("left"); },
      on: { submit: (args, enq) => { const { actions } = args; actions.track("submit"); enq(actions.track, "queued"); return { target: "done" }; } },
    },
    done: {},
  },
});
`,
  );
  expect(messages).toHaveLength(3);
});

it("accepts enqueued named actions and guard calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createMachine } from "xstate";
export const machine = createMachine({
  actions: { notify: (params: { msg: string }) => console.log(params.msg) },
  guards: { isReady: (ready: boolean) => ready },
  context: { ready: false },
  initial: "idle",
  states: {
    idle: {
      on: {
        submit: ({ context, actions, guards }, enq) => {
          if (!guards.isReady(context.ready)) return;
          enq(actions.notify, { msg: "Charging" });
          enq(() => actions.notify({ msg: "inside an enqueued effect" }));
          return { target: "charging" };
        },
      },
    },
    charging: {},
  },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores action implementations and non-handler functions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createMachine } from "xstate";
const actions = { notify: (msg: string) => console.log(msg) };
export function helper({ actions: local }: { actions: typeof actions }) { local.notify("outside"); }
export const machine = createMachine({
  actions: { entry: (params: { actions: typeof actions }) => { params.actions.notify("implementation"); } },
  context: ({ input }: { input: { actions: typeof actions } }) => { input.actions.notify("factory"); return {}; },
  initial: "idle",
  states: { idle: {} },
});
`,
    ),
  ).resolves.toBeUndefined();
});
