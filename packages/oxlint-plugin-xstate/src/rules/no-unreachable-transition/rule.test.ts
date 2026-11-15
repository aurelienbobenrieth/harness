import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/no-unreachable-transition";

it("reports an unguarded branch before a guarded one in on arrays", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { SUBMIT: [{ target: "a" }, { guard: "isValid", target: "b" }] } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a string shorthand before other branches in always", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ states: { a: { always: ["b", { guard: "isValid", target: "c" }] } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports an unguarded targetless always transition", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ states: { a: { always: { actions: "recalculate" } } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts an unguarded always transition targeting its own state, which settles in v5 and v6", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ states: { idle: { always: { target: "idle" } } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inside createStateConfig and onDone arrays", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nconst s = setup({ types: {} });\nexport const loading = s.createStateConfig({ invoke: { src: "load", onDone: [{ target: "ok" }, { guard: "isEmpty", target: "empty" }] } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts guarded branches followed by a default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { SUBMIT: [{ guard: "isValid", target: "b" }, { target: "a" }] }, states: { a: { always: [{ guard: "isDone", target: "b" }, { target: "c" }] } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts a guarded targetless always transition", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ states: { a: { always: { guard: "isDirty", actions: "recalculate" } } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts an unguarded always transition that leaves the state", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ states: { a: { always: { target: "b" } }, b: {} } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("skips branches that cannot be read statically", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { SUBMIT: [{ ...shared }, { guard: "isValid", target: "b" }] } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores transition-shaped objects outside machine config", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const table = { on: { SUBMIT: [{ target: "a" }, { guard: "isValid", target: "b" }] }, always: { actions: "x" } };\nconsole.log(setup);\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports an XState v6 static always patch without a target", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine } from "xstate";\nexport const m = createMachine({ context: { n: 0 }, initial: "a", states: { a: { always: { context: { n: 1 } } } } });\n',
      { message: /return undefined once nothing changes in XState v6/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports an XState v6 always function that returns a targetless context patch", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine } from "xstate";\nexport const m = createMachine({ context: { n: 0 }, initial: "a", states: { a: { always: ({ context }) => ({ context: { n: context.n + 1 } }) } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports an XState v6 always block whose every return is a targetless context patch", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setupEffect } from "@xstate/effect";\nexport const m = setupEffect({}).createMachine({ context: { n: 0 }, initial: "a", states: { a: { always: ({ context }) => { if (context.n > 2) return { context: { n: 0 } }; return { context: { n: context.n + 1 } }; } } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts XState v6 always functions that can return undefined or a target", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nexport const a = createMachine({ context: { n: 0 }, initial: "a", states: { a: { always: ({ context }) => { if (context.n > 2) return; return { context: { n: context.n + 1 } }; } } } });\nexport const b = createMachine({ context: { n: 0 }, initial: "a", states: { a: { always: ({ context }) => (context.n < 3 ? { context: { n: context.n + 1 } } : undefined) } } });\nexport const c = createMachine({ context: { n: 0 }, initial: "a", states: { a: { always: ({ context }) => ({ target: "b", context: { n: context.n + 1 } }) }, b: {} } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts targetless always transitions with nothing to re-run", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nexport const a = createMachine({ initial: "a", states: { a: { always: {} } } });\nexport const b = createMachine({ initial: "a", states: { a: { always: () => ({}) } } });\nexport const c = createMachine({ initial: "a", states: { a: { always: { description: "settles" } } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts an XState v6 always transition decided by a to function", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nexport const m = createMachine({ context: { n: 0 }, initial: "a", states: { a: { always: { to: ({ context }) => (context.n > 2 ? undefined : { context: { n: context.n + 1 } }) } } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reads the config of an XState v6 createStateConfig(path, config)", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nconst s = setup({ actors: {} });\nexport const counting = s.createStateConfig("counting", { always: ({ context }) => ({ context }) });\n',
    ),
  ).resolves.toBeUndefined();
});
