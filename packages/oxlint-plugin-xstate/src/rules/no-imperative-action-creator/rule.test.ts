import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/no-imperative-action-creator";

it("reports assign called as a statement inside an inline action", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ entry: ({ context }) => { assign({ count: context.count + 1 }); } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports raise called as a statement inside enqueueActions", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const a = enqueueActions(({ enqueue, event }) => { if (event.ok) raise({ type: "DONE" }); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports awaited and voided creator calls", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport async function run() { void sendTo("child", { type: "PING" }); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a concise arrow returning a creator in an action slot", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ entry: () => assign({ count: 1 }) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a concise arrow inside an actions array", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { GO: { actions: [() => raise({ type: "DONE" })] } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a concise arrow declared under setup({ actions })", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const s = setup({ types: {}, actions: { bump: () => assign({ count: 1 }) } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports creators destructured from a setup result", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nconst machineSetup = setup({ types: {} });\nconst { assign: update } = machineSetup;\nexport function run() { update({ count: 1 }); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports setup-bound creators called as statements", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nconst machineSetup = setup({ types: {} });\nexport function run() { machineSetup.assign({ count: 1 }); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports namespace-imported creators", async () => {
  await expect(
    assertRuleReports(ruleName, 'import * as xstate from "xstate";\nexport function run() { xstate.log("hello"); }\n'),
  ).resolves.toBeUndefined();
});

it("accepts creators passed as the action value", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ entry: assign({ count: ({ context }) => context.count + 1 }) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts enqueue.* calls and enqueue(creator()) inside enqueueActions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const a = enqueueActions(({ enqueue }) => { enqueue.assign({ count: 1 }); enqueue.raise({ type: "DONE" }); enqueue(log("x")); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores same-named functions that are not imported from xstate", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, log } from "./local.js";\nexport function run() { assign({ count: 1 }); log("x"); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores a concise arrow returning a creator outside action slots", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nexport const makeBump = () => assign({ count: 1 });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores unrelated members named like creators", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, raise, sendTo, enqueueActions, setup, log } from "xstate";\nconst logger = { log(value: string) { return value; } };\nexport function run() { logger.log("x"); console.log(assign); }\n',
    ),
  ).resolves.toBeUndefined();
});
