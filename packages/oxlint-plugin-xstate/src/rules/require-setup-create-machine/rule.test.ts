import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/require-setup-create-machine";

it("reports bare createMachine calls when imported from xstate", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine } from "xstate";\nconst machine = createMachine({ id: "oio.cart" });\nconsole.log(machine);\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports aliased createMachine imports from xstate", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine as defineMachine } from "xstate";\nconst machine = defineMachine({ id: "oio.cart" });\nconsole.log(machine);\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts setup().createMachine()", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nconst machine = setup({ types: {}, actions: {} }).createMachine({ id: "oio.cart" });\nconsole.log(machine);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores createMachine imported from another module", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "./local-factory.js";\nconst machine = createMachine({ id: "oio.cart" });\nconsole.log(machine);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores files without an xstate createMachine import", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const machine = createMachine({ id: "oio.cart" });\nconsole.log(machine);\n'),
  ).resolves.toBeUndefined();
});

it("reports setup() called without an argument", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup().createMachine({ id: "app.cart" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports setup({})", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({}).createMachine({ id: "app.cart" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports setup() lacking a types declaration", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ actions: {} }).createMachine({ id: "app.cart" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts setup() declaring types", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const m = setup({ types: { context: {} as { count: number } } }).createMachine({ id: "app.cart" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("skips setup() arguments that cannot be read statically", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nexport const a = setup(sharedConfig);\nexport const b = setup({ ...sharedConfig, actions: {} });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores setup imported from another module", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { setup } from "./test-utils.js";\nsetup({});\n'),
  ).resolves.toBeUndefined();
});

it("accepts XState v6 createMachine, setup, setupEffect and system.setup declaring schemas", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine, createSystem, setup, types } from "xstate";\nimport { setupEffect } from "@xstate/effect";\nimport { Schema } from "effect";\nexport const a = createMachine({ schemas: { context: types<{ n: number }>() }, context: { n: 0 } });\nexport const b = setup({ schemas: { context: types<{ n: number }>() } });\nexport const c = setupEffect({ schemas: { context: Schema.Struct({ n: Schema.Number }) } });\nexport const d = createSystem({ registry: {} }).setup({ schemas: { context: types<{ n: number }>() } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts a bare XState v5 createMachine declaring types", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nexport const m = createMachine({ types: {} as { context: { count: number } }, context: { count: 0 } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts a setup without schemas whose machines declare them", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup, types } from "xstate";\nexport const a = setup({ actions: { log: () => {} } }).createMachine({ schemas: { context: types<{ n: number }>() }, context: { n: 0 } });\nconst s = setup({ actions: { log: () => {} } });\nexport const b = s.createMachine({ schemas: { context: types<{ n: number }>() }, context: { n: 0 } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports an XState v6 createMachine without schemas", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine } from "xstate";\nexport const m = createMachine({ context: { n: 0 } });\n',
      { message: /createMachine\(\) without types or schemas leaves context and events untyped/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports setupEffect without schemas", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setupEffect } from "@xstate/effect";\nimport { Effect } from "effect";\nexport const s = setupEffect({ actions: { audit: () => Effect.void } });\n',
      { message: /setupEffect\(\) without types or schemas/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports system.setup() without schemas", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nexport const m = system.setup().createMachine({ id: "app.cart" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a setup binding used by at least one untyped machine", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup, types } from "xstate";\nconst s = setup({ actions: {} });\nexport const a = s.createMachine({ schemas: { context: types<{ n: number }>() }, context: { n: 0 } });\nexport const b = s.createMachine({ id: "app.other" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores setupEffect and createSystem from other modules", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setupEffect } from "./effect-setup.js";\nimport { createSystem } from "./system.js";\nexport const a = setupEffect({});\nexport const b = createSystem({}).setup();\n',
    ),
  ).resolves.toBeUndefined();
});
