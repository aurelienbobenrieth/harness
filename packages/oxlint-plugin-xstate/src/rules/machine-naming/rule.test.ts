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
