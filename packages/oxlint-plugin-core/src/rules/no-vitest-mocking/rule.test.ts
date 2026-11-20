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

const sources = ["vitest", "vite-plus/test", "@effect/vitest"];

it.each(sources)("reports every banned replacement imported from %s", async (source) => {
  await Promise.all([
    ...["mock", "doMock", "unmock", "doUnmock"].map((method) =>
      assertRuleReports(ruleName, `import { vi } from "${source}"; vi.${method}("./api");`),
    ),
    assertRuleReports(ruleName, `import { vi as tools } from "${source}"; tools.mock("./api");`),
    assertRuleReports(ruleName, `import * as tests from "${source}"; tests.vi.doMock("./api");`),
  ]);
});

it.each(sources)("keeps %s spies and fakes valid unless forbidSpies is set", async (source) => {
  const code = `import { vi } from "${source}"; vi.fn(); vi.spyOn(api, "read");`;
  await assertRuleDoesNotReport(ruleName, code);
  await assertRuleReports(ruleName, code, { ruleOptions: { forbidSpies: true } });
});

it.each(sources)("allows mocking from %s in testing folders", async (source) => {
  await assertRuleDoesNotReport(ruleName, `import { vi } from "${source}"; vi.mock("./api");`, {
    filename: "src/testing/setup.ts",
  });
});

it.each(sources)("reports stubGlobal and stubEnv from %s only with forbidStubs", async (source) => {
  await Promise.all(
    ["stubGlobal", "stubEnv"].map(async (method) => {
      const code = `import { vi } from "${source}"; vi.${method}("X", 1);`;
      await assertRuleDoesNotReport(ruleName, code);
      await assertRuleReports(ruleName, code, { ruleOptions: { forbidStubs: true } });
    }),
  );
});

it("ignores a vi from an unrelated module", async () => {
  await assertRuleDoesNotReport(ruleName, 'import { vi } from "other"; vi.mock("./api");');
});
