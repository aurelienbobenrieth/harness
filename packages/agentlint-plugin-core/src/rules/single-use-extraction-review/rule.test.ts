import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineSingleUseExtractionReview, singleUseExtractionReview } from "./rule.js";

it("reports one substantial file-local helper with one caller", async () => {
  const findings = await testRuleOnSource({
    rule: singleUseExtractionReview,
    source:
      "function complete(order, customer) {\n  validate(order);\n  reserve(order);\n  notify(customer);\n}\nexport function run(order, customer) {\n  complete(order, customer);\n}",
  });
  expect(findings.map((finding) => [finding.authority, finding.message])).toEqual([
    [
      "human",
      "File-local helper `complete` has one caller, 2 parameters and 3 statements; keep it only when it names a concept or owns a contract that repays the extra navigation.",
    ],
  ]);
});

it("stays silent for small helpers, reused helpers and exported boundaries", async () => {
  const sources = [
    "function trim(value) { return value.trim(); }\nexport const run = (value) => trim(value);",
    "function complete(order, customer) { validate(order); reserve(order); notify(customer); }\ncomplete(a, b);\ncomplete(c, d);",
    "export function complete(order, customer) { validate(order); reserve(order); notify(customer); }\ncomplete(a, b);",
  ];
  const findings = await Promise.all(
    sources.map((source) => testRuleOnSource({ rule: singleUseExtractionReview, source })),
  );
  expect(findings).toEqual([[], [], []]);
});

it("supports calibrated thresholds and rejects invalid values", async () => {
  const rule = defineSingleUseExtractionReview({ minParameters: 1, minStatements: 2 });
  expect(
    await testRuleOnSource({
      rule,
      source: "const prepare = (order) => { validate(order); reserve(order); };\nprepare(order);",
    }),
  ).toHaveLength(1);
  expect(() => defineSingleUseExtractionReview({ minParameters: 0 })).toThrow("must be a positive integer");
});
