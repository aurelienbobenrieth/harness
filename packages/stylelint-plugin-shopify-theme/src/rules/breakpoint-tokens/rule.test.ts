import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";
import { breakpointTokens, breakpointTokensRuleName } from "./rule.js";

const allowed = ["(min-width: 750px)", "(min-width: 990px)"];

it("reports media queries outside the shared breakpoint set", async () => {
  await expect(
    assertRuleReports(
      breakpointTokens,
      breakpointTokensRuleName,
      "@media (min-width: 768px) { .a { display: none; } }",
      {
        ruleOptions: { allowed },
      },
    ),
  ).resolves.toBeUndefined();
});

it("accepts allowed breakpoints regardless of formatting", async () => {
  await expect(
    assertRuleDoesNotReport(
      breakpointTokens,
      breakpointTokensRuleName,
      "@media (min-width:750px) { .a { display: none; } }",
      { ruleOptions: { allowed } },
    ),
  ).resolves.toBeUndefined();
});

it("stays silent without a configured breakpoint set", async () => {
  await expect(
    assertRuleDoesNotReport(
      breakpointTokens,
      breakpointTokensRuleName,
      "@media (min-width: 123px) { .a { display: none; } }",
    ),
  ).resolves.toBeUndefined();
});
