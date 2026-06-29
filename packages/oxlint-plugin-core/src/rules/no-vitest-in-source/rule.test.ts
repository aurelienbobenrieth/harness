import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-vitest-in-source";

it("reports vitest imports in source files", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { expect } from "vitest";\n', {
      filename: "src/domain/user.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows vitest imports in test files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { expect, it } from "vitest";\n', {
      filename: "src/domain/user.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows vitest imports in spec files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { expect, it } from "vitest";\n', {
      filename: "src/domain/user.spec.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows vitest imports in setup files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { vi } from "vitest";\n', {
      filename: "vitest.setup.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows vitest imports in test utilities", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { expect } from "vitest";\n', {
      filename: "src/test-utils/assertions.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-vitest imports", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { test } from "node:test";\n', {
      filename: "src/domain/user.ts",
    }),
  ).resolves.toBeUndefined();
});
