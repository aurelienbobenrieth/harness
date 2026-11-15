import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReportsInEffect as assertRuleReports } from "../test-support.ts";

const ruleName = "effect/prefer-effect-array-helpers";
const withEffect = (code: string): string => `import { Effect } from "effect";\n${code}`;
const mapUsers = "const users: User[] = []; const names = users.map((user) => user.name);\n";

it("reports native array map calls in source files", async () => {
  await expect(
    assertRuleReports(ruleName, withEffect(mapUsers), { filename: "packages/core/src/users.ts" }),
  ).resolves.toBeUndefined();
});

it("reports native array reduce calls in source files", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      withEffect("const items: Item[] = []; const total = items.reduce((sum, item) => sum + item.count, 0);\n"),
      { filename: "packages/core/src/items.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("reports in a file that imports a scoped Effect package", async () => {
  await expect(
    assertRuleReports(ruleName, `import { HttpClient } from "@effect/platform";\n${mapUsers}`, {
      filename: "packages/core/src/users.ts",
    }),
  ).resolves.toBeUndefined();
});

it("stays silent in a file that does not import Effect", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, `${mapUsers}const ok = [1, 2].includes(1);\n`, { filename: "tools/report.ts" }),
  ).resolves.toBeUndefined();
});

it("allows Effect helpers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, withEffect("const names = Effect.forEach(users, userName);\n"), {
      filename: "packages/core/src/users.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows ignored object helpers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, withEffect("const values = Option.map(value, fn);\n"), {
      filename: "packages/core/src/users.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows configured escape-hatch files", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Effect } from "effect"; Effect.sync(() => { const users: User[] = []; users.map((user) => user.name); });',
      {
        filename: "packages/core/src/legacy/users.ts",
        ruleOptions: { allow: ["**/legacy/**"] },
      },
    ),
  ).resolves.toBeUndefined();
});

it("allows configured ignored objects", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Effect } from "effect"; Effect.sync(() => { const users: User[] = []; users.map((user) => user.name); });',
      {
        filename: "packages/core/src/users.ts",
        ruleOptions: { ignoredObjects: ["users"] },
      },
    ),
  ).resolves.toBeUndefined();
});

it('accepts regression: "hello".includes("h");', async () => {
  await assertRuleDoesNotReport(ruleName, '"hello".includes("h");');
});
