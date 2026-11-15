import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-widen-then-assert";

it("reports widening a known initializer and re-asserting it later", async () => {
  await expect(
    assertRuleReports(ruleName, "function handle() {\n  const data: unknown = { id: 1 };\n  return data as User;\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports widening through an initializer assertion", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "function handle() {\n  const data = { id: 1 } as unknown;\n  return data as User;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports widen-then-assert at module scope", async () => {
  await expect(
    assertRuleReports(ruleName, "const data: unknown = { id: 1 };\nconst user = data as User;\n"),
  ).resolves.toBeUndefined();
});

it("reports re-narrowing a binding declared as a broad Record", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "function handle() {\n  const data: Record<string, unknown> = { id: 1 };\n  return data as User;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows broad bindings whose initializer has no known evidence", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function handle(raw: string) {\n  const data: unknown = JSON.parse(raw);\n  return data as User;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows asserting a precisely typed binding", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function handle() {\n  const data = { id: 1 };\n  return data as User;\n}\n"),
  ).resolves.toBeUndefined();
});

it("allows re-asserting to another broad type", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function handle() {\n  const data: unknown = { id: 1 };\n  return data as unknown;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports the same captured binding across a function boundary", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "function outer() {\n  const data: unknown = { id: 1 };\n  return () => data as User;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows reassigned let bindings", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function handle() {\n  let data: unknown = { id: 1 };\n  data = load();\n  return data as User;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("keeps shadowed block bindings separate", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "const data: unknown = { id: 1 }; { const data = external; consume(data as User); }",
  );
  await assertRuleReports(
    ruleName,
    "const data: unknown = { id: 1 }; { const data = external; consume(data); } consume(data as User);",
  );
});

it("allows a generic builder that asserts to its own type parameter", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function build<T>(keys: string[]): T {\n  const out: Record<string, unknown> = {};\n  for (const key of keys) out[key] = 1;\n  return out as T;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("still reports an assertion to a non-generic type after a broad record", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "function build<T>(keys: string[]) {\n  const out: Record<string, unknown> = {};\n  out.a = 1;\n  return out as User;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("stays silent in test files", async () => {
  await expect(
    assertRuleReports(ruleName, "const data: unknown = { id: 1 };\nconst user = data as User;\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, "const data: unknown = { id: 1 };\nconst user = data as User;\n", {
      filename: "src/sample.test.ts",
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, "const data: unknown = { id: 1 };\nconst user = data as User;\n", {
      filename: "__tests__/sample.ts",
    }),
  ).resolves.toBeUndefined();
});
