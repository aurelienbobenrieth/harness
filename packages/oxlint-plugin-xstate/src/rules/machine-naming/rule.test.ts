import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/machine-naming";

it("reports machine ids outside the default namespace", async () => {
  await expect(
    assertRuleReports(ruleName, 'const machine = createMachine({ id: "Bad Machine ID" });\nconsole.log(machine);\n'),
  ).resolves.toBeUndefined();
});

it("accepts machine ids in the default namespace", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const machine = createMachine({ id: "oio.cart" });\nconsole.log(machine);\n'),
  ).resolves.toBeUndefined();
});

it("checks setup().createMachine ids", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const machine = setup({ actions: {} }).createMachine({ id: "cart" });\nconsole.log(machine);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores machines without an id", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const machine = createMachine({ initial: 'idle' });\nconsole.log(machine);\n"),
  ).resolves.toBeUndefined();
});

it("honours a configured pattern", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const machine = createMachine({ id: "acme.cart" });\nconsole.log(machine);\n', {
      ruleOptions: { pattern: "^acme\\.[a-z0-9-]+$" },
    }),
  ).resolves.toBeUndefined();
});

it("checks XState v6 setupEffect().createMachine ids", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setupEffect } from "@xstate/effect";\nexport const machine = setupEffect({}).createMachine({ id: "Cart" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("checks XState v6 system.setup().createMachine ids", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nexport const machine = system.setup().createMachine({ id: "cart" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts namespaced XState v6 ids next to a version", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createSystem } from "xstate";\nimport { setupEffect } from "@xstate/effect";\nconst system = createSystem({ registry: {} });\nexport const a = system.setup().createMachine({ id: "app.cart", version: "2" });\nexport const b = setupEffect({}).createMachine({ id: "app.checkout" });\n',
    ),
  ).resolves.toBeUndefined();
});
