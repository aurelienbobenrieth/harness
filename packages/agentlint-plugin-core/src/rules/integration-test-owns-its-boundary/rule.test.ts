import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineIntegrationTestOwnsItsBoundary, integrationTestOwnsItsBoundary } from "./rule.js";

const message =
  "File claims to be an integration test but constructs test doubles; show that the claimed boundary runs for real, or rename and move it as a unit test.";
const stubbed = 'it("saves", async () => {\n  const repository = { save: vi.fn() };\n  await place(repository);\n});\n';
const inMemory =
  'it("saves", async () => {\n  const repository = new InMemoryOrderRepository();\n  await place(repository);\n});\n';
const real =
  'it("saves", async () => {\n  const repository = new SqlOrderRepository(await startDatabase());\n  await place(repository);\n});\n';

async function messages(source: string, file: string, rule = integrationTestOwnsItsBoundary) {
  return (await testRuleOnSource({ rule: rule, source: source, file: file })).map((finding) => finding.message);
}

it("reports integration-named files and folders that construct doubles, once per file", async () => {
  expect(await messages(stubbed + stubbed, "src/orders.integration.test.ts")).toEqual([message]);
  expect(await messages(inMemory, "tests/integration/orders.test.ts")).toEqual([message]);
  expect(await messages(stubbed, "apps/shop/e2e/checkout.spec.ts")).toEqual([message]);
});

it("reports a file whose first describe title claims integration", async () => {
  expect(await messages(`describe("orders integration", () => {\n${stubbed}});\n`, "src/orders.test.ts")).toEqual([
    message,
  ]);
  expect(
    await messages(
      `describe("orders", () => {\n${stubbed}});\ndescribe("integration notes", () => {});\n`,
      "src/orders.test.ts",
    ),
  ).toEqual([]);
});

it("stays silent on unit tests with doubles and on integration tests without any", async () => {
  expect(await messages(stubbed, "src/orders.test.ts")).toEqual([]);
  expect(await messages(real, "src/orders.integration.test.ts")).toEqual([]);
  expect(await messages(stubbed, "src/integration/orders.ts")).toEqual([]);
});

it("does not read `int` substrings or contract suites as integration claims", async () => {
  expect(await messages(stubbed, "src/interaction.test.ts")).toEqual([]);
  expect(await messages(stubbed, "src/print.test.ts")).toEqual([]);
  expect(await messages(stubbed, "src/reintegration.test.ts")).toEqual([]);
  expect(await messages(inMemory, "src/orders.contract.test.ts")).toEqual([]);
});

it("ignores double names that only appear in strings and comments", async () => {
  const source = `// uses FakeMailer elsewhere, vi.fn() not needed\nit("talks about InMemoryStore", async () => {\n  await place(new SqlOrderRepository(db));\n});\n`;
  expect(await messages(source, "src/orders.integration.test.ts")).toEqual([]);
});

it("carries the sorted unique doubles as evidence", async () => {
  const file = "src/orders.integration.test.ts";
  const [one] = await testRuleOnSource({
    rule: integrationTestOwnsItsBoundary,
    source: stubbed,
    file: file,
  });
  const [same] = await testRuleOnSource({
    rule: integrationTestOwnsItsBoundary,
    source: stubbed.replace("vi.fn()", "vi.fn( )"),
    file: file,
  });
  const [other] = await testRuleOnSource({
    rule: integrationTestOwnsItsBoundary,
    source: inMemory,
    file: file,
  });
  expect(one?.fingerprint).toBeDefined();
  expect(other?.fingerprint).not.toStrictEqual(one?.fingerprint);
  expect(same?.line).toBe(one?.line);
});

it("honours custom patterns and mirrors them into the binding", async () => {
  const rule = defineIntegrationTestOwnsItsBoundary({
    integrationPattern: /^it$/g,
    doublePattern: /\bsinon\.stub\s*\(/g,
  });
  const source = 'it("saves", () => {\n  const save = sinon.stub();\n});\n';
  expect(await messages(source, "tests/it/orders.test.ts", rule)).toEqual([message]);
  expect(await messages(source, "tests/it/orders.test.ts", rule)).toEqual([message]);
  expect(await messages(source, "tests/integration/orders.test.ts", rule)).toEqual([]);
  expect(await messages(stubbed, "tests/it/orders.test.ts", rule)).toEqual([]);
  expect(rule.binding.options).toEqual({
    integrationPattern: { source: "^it$", flags: "g" },
    doublePattern: { source: "\\bsinon\\.stub\\s*\\(", flags: "g" },
  });
});
