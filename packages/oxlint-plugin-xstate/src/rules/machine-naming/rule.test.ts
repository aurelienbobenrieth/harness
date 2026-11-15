import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "xstate/machine-naming";

const dotted = { ruleOptions: { pattern: "^[a-z][a-z0-9-]*[.][a-z][a-z0-9-]*$" } };

it("reports machine ids outside the configured pattern", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const machine = createMachine({ id: "Bad Machine ID" });\nconsole.log(machine);\n',
      dotted,
    ),
  ).resolves.toBeUndefined();
});

it("accepts machine ids matching the configured pattern", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const machine = createMachine({ id: "oio.cart" });\nconsole.log(machine);\n',
      dotted,
    ),
  ).resolves.toBeUndefined();
});

it("reports once per file that the rule needs a configured pattern", async () => {
  const messages = await reportedMessages(
    ruleName,
    'const a = createMachine({ id: "a" });\nconst b = createMachine({ id: "b" });\nconsole.log(a, b);\n',
  );
  expect(messages).toHaveLength(1);
  expect(messages[0]).toContain("`pattern` option");
});

it("stays silent without a configured pattern in files that define no machine", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "export const value = 1;\n")).resolves.toBeUndefined();
});

it("checks setup().createMachine ids", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const machine = setup({ actions: {} }).createMachine({ id: "cart" });\nconsole.log(machine);\n',
      dotted,
    ),
  ).resolves.toBeUndefined();
});

it("ignores machines without an id", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const machine = createMachine({ initial: 'idle' });\nconsole.log(machine);\n",
      dotted,
    ),
  ).resolves.toBeUndefined();
});

it("honours a custom pattern", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const machine = createMachine({ id: "acme.cart" });\nconsole.log(machine);\n', {
      ruleOptions: { pattern: "^acme[.][a-z0-9-]+$" },
    }),
  ).resolves.toBeUndefined();
});

it("checks XState v6 setupEffect().createMachine ids", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setupEffect } from "@xstate/effect";\nexport const machine = setupEffect({}).createMachine({ id: "Cart" });\n',
      dotted,
    ),
  ).resolves.toBeUndefined();
});

it("checks XState v6 system.setup().createMachine ids", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nexport const machine = system.setup().createMachine({ id: "cart" });\n',
      dotted,
    ),
  ).resolves.toBeUndefined();
});

it("accepts namespaced XState v6 ids next to a version", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createSystem } from "xstate";\nimport { setupEffect } from "@xstate/effect";\nconst system = createSystem({ registry: {} });\nexport const a = system.setup().createMachine({ id: "app.cart", version: "2" });\nexport const b = setupEffect({}).createMachine({ id: "app.checkout" });\n',
      dotted,
    ),
  ).resolves.toBeUndefined();
});
