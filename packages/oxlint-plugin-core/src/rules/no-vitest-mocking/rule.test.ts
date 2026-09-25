import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

it("resolves aliased and namespace Vitest mocking calls", async () => {
  await assertRuleReports("core/no-vitest-mocking", 'import { vi as tools } from "vitest"; tools.mock("./api");');
  await assertRuleReports("core/no-vitest-mocking", 'import * as tests from "vitest"; tests.vi.mock("./api");');
});

it("ignores local vi shadows and permits aliased spies by default", async () => {
  await assertRuleDoesNotReport("core/no-vitest-mocking", 'function run(vi) { vi.mock("./api"); }');
  await assertRuleDoesNotReport(
    "core/no-vitest-mocking",
    'import { vi as tools } from "vitest"; tools.spyOn(api, "read");',
  );
  await assertRuleReports("core/no-vitest-mocking", 'import { vi as tools } from "vitest"; tools.spyOn(api, "read");', {
    ruleOptions: { forbidSpies: true },
  });
});

const ruleName = "core/no-vitest-mocking";

it("allows deterministic vi.fn doubles", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const send = vi.fn();\n")).resolves.toBeUndefined();
});

it("reports vi.mock calls", async () => {
  await expect(assertRuleReports(ruleName, 'vi.mock("./client");\n')).resolves.toBeUndefined();
});

it("allows observable interaction spies", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "vi.spyOn(client, 'send');\n")).resolves.toBeUndefined();
});

it("allows mocking in vitest setup files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'vi.mock("./env");\n', {
      filename: "vitest.setup.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows mocking in test utilities", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const makeSpy = () => vi.fn();\n", {
      filename: "src/test-utils/mock.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-vi calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "mock.fn();\n")).resolves.toBeUndefined();
});
