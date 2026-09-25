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
