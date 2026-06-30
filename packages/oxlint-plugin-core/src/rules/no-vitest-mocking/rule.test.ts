import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-vitest-mocking";

it("reports vi.fn calls", async () => {
  await expect(assertRuleReports(ruleName, "const send = vi.fn();\n")).resolves.toBeUndefined();
});

it("reports vi.mock calls", async () => {
  await expect(assertRuleReports(ruleName, 'vi.mock("./client");\n')).resolves.toBeUndefined();
});

it("reports vi.spyOn calls", async () => {
  await expect(assertRuleReports(ruleName, "vi.spyOn(client, 'send');\n")).resolves.toBeUndefined();
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
