import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-object-parameters";

it("reports parameters annotated with the object keyword", async () => {
  await expect(
    assertRuleReports(ruleName, "function handle(payload: object) { return payload; }\n"),
  ).resolves.toBeUndefined();
});

it("reports object reached through a same-file alias", async () => {
  await expect(
    assertRuleReports(ruleName, "type Payload = object;\nfunction handle(payload: Payload) { return payload; }\n"),
  ).resolves.toBeUndefined();
});

it("reports unions containing the object keyword", async () => {
  await expect(
    assertRuleReports(ruleName, "function handle(payload: object | null) { return payload; }\n"),
  ).resolves.toBeUndefined();
});

it("reports constructor parameter properties typed as object", async () => {
  await expect(
    assertRuleReports(ruleName, "class Store {\n  constructor(private readonly payload: object) {}\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports object parameters in interface method signatures", async () => {
  await expect(
    assertRuleReports(ruleName, "interface Handler {\n  handle(payload: object): void;\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports object parameters in function type aliases", async () => {
  await expect(assertRuleReports(ruleName, "type Handler = (payload: object) => void;\n")).resolves.toBeUndefined();
});

it("allows generic parameters constrained by object", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function handle<T extends object>(payload: T) { return payload; }\n"),
  ).resolves.toBeUndefined();
});

it("allows inline shapes", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function handle(payload: { id: string }) { return payload; }\n"),
  ).resolves.toBeUndefined();
});

it("allows aliases that resolve to a concrete shape", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "type Payload = { id: string };\nfunction handle(payload: Payload) { return payload; }\n",
    ),
  ).resolves.toBeUndefined();
});
