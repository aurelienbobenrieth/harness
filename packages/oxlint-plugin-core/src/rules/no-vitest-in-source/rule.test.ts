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

it.each([
  "packages/ui/src/button.test-d.tsx",
  "scripts/test-setup.mjs",
  "src/test-support.ts",
  "packages/server/src/__tests__/resource.ts",
  "tests/utils.ts",
  "packages/core/test/helpers.ts",
  "src/__mocks__/clock.ts",
  "e2e/fixtures.ts",
])("allows vitest imports in test helpers and test folders: %s", async (filename) => {
  await assertRuleDoesNotReport(ruleName, 'import { expect } from "vitest";\n', { filename });
});

it.each(["src/latest/clock.ts", "src/contest.ts", "src/testimony/index.ts"])(
  "still reports source files whose path only resembles a test folder: %s",
  async (filename) => {
    await assertRuleReports(ruleName, 'import { expect } from "vitest";\n', { filename });
  },
);
