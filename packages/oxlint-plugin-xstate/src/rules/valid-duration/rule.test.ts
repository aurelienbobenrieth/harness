import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";
import { isParsableDuration } from "./rule.js";

const ruleName = "xstate/valid-duration";

describe("isParsableDuration", () => {
  it.each(["500ms", "500MS", "1.5s", ".5s", " 5s ", "PT1M30S", "p1d", "P2W", "PT1,5S"])(
    "accepts %j like the v6 delay parser",
    (value) => {
      expect(isParsableDuration(value)).toBe(true);
    },
  );

  it.each(["5m", "1h", "1d", "5 s", "1,5s", "1000", "1e3", "2min", "P1M", "P1Y", "PT"])(
    "rejects %j like the v6 delay parser",
    (value) => {
      expect(isParsableDuration(value)).toBe(false);
    },
  );
});

it("reports an after key the parser rejects", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { createMachine } from "xstate";
export const machine = createMachine({ initial: "a", states: { a: { after: { "5m": { target: "b" } } }, b: {} } });
`,
  );
  expect(messages).toEqual([
    '"5m" is neither a delay declared in delays nor a duration XState parses, so the timer puts the actor in status \'error\' when the state is entered. Write milliseconds (300000), "<n>ms", "<n>s", or ISO 8601 ("PT5M"), or declare the name in delays.',
  ]);
});

it("reports a duration-like key in an extended setup's machine", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { setup } from "xstate";
export const machine = setup({}).extend({}).createMachine({ initial: "a", states: { a: { after: { "2min": { target: "b" } } }, b: {} } });
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports state timeouts, string-number timeouts, and createAsyncLogic timeouts", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { createAsyncLogic, setup } from "xstate";
export const load = createAsyncLogic({ timeout: "30sec", run: async () => 1 });
export const machine = setup({}).createMachine({
  initial: "a",
  states: {
    a: { timeout: "1h", onTimeout: { target: "b" } },
    b: { timeout: "1000", onTimeout: { target: "a" } },
  },
});
`,
  );
  expect(messages).toHaveLength(3);
  expect(messages.filter((text) => text.includes("never times out"))).toHaveLength(1);
});

it("accepts parsable durations, numeric keys, and numbers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createAsyncLogic, createMachine } from "xstate";
export const load = createAsyncLogic({ timeout: "PT30S", run: async () => 1 });
export const machine = createMachine({
  initial: "a",
  states: {
    a: { after: { 1000: { target: "b" }, "250": { target: "b" }, "1.5s": { target: "b" }, "PT5M": { target: "b" } } },
    b: { timeout: 5000, onTimeout: { target: "c" } },
    c: { timeout: "500ms", onTimeout: { target: "a" } },
  },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts names declared in delays and names that do not look like durations", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { setup } from "xstate";
const s = setup({ delays: { "5m": 300_000, retryDelay: 1000 } });
export const machine = s.createMachine({
  initial: "a",
  states: {
    a: { after: { "5m": { target: "b" }, retryDelay: { target: "b" }, "slow": { target: "b" } } },
    b: { timeout: "retryDelay", onTimeout: { target: "a" } },
  },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores files and objects outside xstate", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createMachine } from "./local.js";
export const machine = createMachine({ states: { a: { after: { "5m": {} }, timeout: "1h" } } });
export const request = { timeout: "5m", after: { "1h": true } };
`,
    ),
  ).resolves.toBeUndefined();
});
