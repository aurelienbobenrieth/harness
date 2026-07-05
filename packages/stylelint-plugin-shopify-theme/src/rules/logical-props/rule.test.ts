import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";
import { logicalProps, logicalPropsRuleName } from "./rule.js";

it("reports physical margin properties", async () => {
  await expect(
    assertRuleReports(logicalProps, logicalPropsRuleName, ".price { margin-left: 1rem; }"),
  ).resolves.toBeUndefined();
});

it("reports physical inset properties", async () => {
  await expect(assertRuleReports(logicalProps, logicalPropsRuleName, ".badge { left: 0; }")).resolves.toBeUndefined();
});

it("reports physical text-align values", async () => {
  await expect(
    assertRuleReports(logicalProps, logicalPropsRuleName, ".price { text-align: left; }"),
  ).resolves.toBeUndefined();
});

it("accepts logical properties", async () => {
  await expect(
    assertRuleDoesNotReport(
      logicalProps,
      logicalPropsRuleName,
      ".price { margin-inline-start: 1rem; inset-inline-start: 0; text-align: start; }",
    ),
  ).resolves.toBeUndefined();
});

it("accepts vertical physical properties", async () => {
  await expect(
    assertRuleDoesNotReport(logicalProps, logicalPropsRuleName, ".price { margin-top: 1rem; }"),
  ).resolves.toBeUndefined();
});
