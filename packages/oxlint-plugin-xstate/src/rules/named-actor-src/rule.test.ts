import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/named-actor-src";

it("reports inline fromPromise as invoke.src", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ invoke: { src: fromPromise(() => load()), onDone: "ready" } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a machine reference as invoke.src inside nested states and arrays", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ states: { loading: { invoke: [{ src: "named" }, { src: childMachine }] } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inline src inside createStateConfig", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nconst s = setup({ types: {} });\nexport const loading = s.createStateConfig({ invoke: { src: fromPromise(() => load()) } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inline logic passed to spawnChild and enqueue.spawnChild", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const a = spawnChild(childMachine);\nexport const b = enqueueActions(({ enqueue }) => { enqueue.spawnChild(fromPromise(() => load())); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports spawn(machine) when checkSpawn is enabled", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const a = assign({ ref: ({ spawn }) => spawn(childMachine) });\n',
      { ruleOptions: { checkSpawn: true } },
    ),
  ).resolves.toBeUndefined();
});

it("reports inline guards when guards is enabled", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { GO: { guard: ({ context }) => context.ok, target: "next" } } });\n',
      { ruleOptions: { guards: true } },
    ),
  ).resolves.toBeUndefined();
});

it("accepts string and no-substitution template sources", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {}, actors: { loadCart: fromPromise(() => load()) } }).createMachine({ invoke: { src: "loadCart" }, states: { a: { invoke: { src: `loadCart` } } } });\nexport const a = spawnChild("loadCart");\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts identifiers bound to string constants", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nconst LOAD = "loadCart";\nexport const m = setup({ types: {} }).createMachine({ invoke: { src: LOAD } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves spawn(machine) alone by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const a = assign({ ref: ({ spawn }) => spawn(childMachine) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves inline guards alone by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { GO: { guard: ({ context }) => context.ok, target: "next" } } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores invoke-shaped objects outside machine config", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const options = { invoke: { src: fromPromise(() => load()) } };\nconsole.log(setup);\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts named guards when guards is enabled", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { assign, enqueueActions, fromPromise, setup, spawnChild } from "xstate";\nexport const m = setup({ types: {} }).createMachine({ on: { GO: { guard: "isOk", target: "next" } } });\n',
      { ruleOptions: { guards: true } },
    ),
  ).resolves.toBeUndefined();
});
