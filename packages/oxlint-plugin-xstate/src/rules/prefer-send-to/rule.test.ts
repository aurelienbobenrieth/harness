import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";
import { preferSendTo } from "./rule.js";

const ruleName = "xstate/prefer-send-to";

it("reports sendParent imported from xstate", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { sendParent } from "xstate";\nexport const notify = sendParent({ type: "DONE" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports enqueue.sendParent", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { enqueueActions } from "xstate";\nexport const a = enqueueActions(({ enqueue }) => { enqueue.sendParent({ type: "DONE" }); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts sendTo with a ref from context", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { sendTo } from "xstate";\nexport const notify = sendTo(({ context }) => context.parentRef, { type: "DONE" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores sendParent from another module", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { sendParent } from "./bus.js";\nexport const notify = sendParent({ type: "DONE" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores sendParent members in files without xstate", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'export function run(bus: any) { bus.sendParent({ type: "DONE" }); }\n'),
  ).resolves.toBeUndefined();
});

it("is deprecated since 0.2.0 without a replacement rule", () => {
  expect(preferSendTo.meta?.deprecated).toMatchObject({ deprecatedSince: "0.2.0" });
  expect(preferSendTo.meta?.deprecated).not.toHaveProperty("replacedBy");
});

it("stays silent on the XState v6 enq.sendTo(parent, event)", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nexport const m = createMachine({ on: { done: ({ parent }, enq) => { enq.sendTo(parent, { type: "done" }); } } });\n',
    ),
  ).resolves.toBeUndefined();
});
