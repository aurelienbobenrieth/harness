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

it("reports an unguarded always transition targeting its own state", async () => {
  await expect(
    assertRuleReports(
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
