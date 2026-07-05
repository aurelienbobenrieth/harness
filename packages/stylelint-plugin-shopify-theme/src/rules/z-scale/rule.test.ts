import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";
import { zScale, zScaleRuleName } from "./rule.js";

it("reports magic z-index numbers", async () => {
  await expect(assertRuleReports(zScale, zScaleRuleName, ".modal { z-index: 9999; }")).resolves.toBeUndefined();
});

it("accepts overlay scale tokens", async () => {
  await expect(
    assertRuleDoesNotReport(zScale, zScaleRuleName, ".modal { z-index: var(--theme-z-modal); }"),
  ).resolves.toBeUndefined();
});

it("accepts structural values", async () => {
  await expect(
    assertRuleDoesNotReport(
      zScale,
      zScaleRuleName,
      ".base { z-index: 0; } .under { z-index: -1; } .auto { z-index: auto; }",
    ),
  ).resolves.toBeUndefined();
});

it("honours a configured pattern", async () => {
  await expect(
    assertRuleDoesNotReport(zScale, zScaleRuleName, ".modal { z-index: var(--acme-layer-modal); }", {
      ruleOptions: { pattern: "^var\\(--acme-layer-[\\w-]+\\)$" },
    }),
  ).resolves.toBeUndefined();
});
