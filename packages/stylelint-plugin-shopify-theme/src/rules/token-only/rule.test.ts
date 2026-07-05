import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";
import { tokenOnly, tokenOnlyRuleName } from "./rule.js";

it("reports raw color values", async () => {
  await expect(assertRuleReports(tokenOnly, tokenOnlyRuleName, ".price { color: #ff0000; }")).resolves.toBeUndefined();
});

it("reports raw spacing values", async () => {
  await expect(assertRuleReports(tokenOnly, tokenOnlyRuleName, ".price { padding: 12px; }")).resolves.toBeUndefined();
});

it("accepts theme token vars", async () => {
  await expect(
    assertRuleDoesNotReport(tokenOnly, tokenOnlyRuleName, ".price { color: var(--scheme-text); }"),
  ).resolves.toBeUndefined();
});

it("accepts mixed zero and token values", async () => {
  await expect(
    assertRuleDoesNotReport(tokenOnly, tokenOnlyRuleName, ".price { margin: 0 var(--theme-space-2); }"),
  ).resolves.toBeUndefined();
});

it("accepts keyword values", async () => {
  await expect(
    assertRuleDoesNotReport(tokenOnly, tokenOnlyRuleName, ".price { box-shadow: none; color: transparent; }"),
  ).resolves.toBeUndefined();
});

it("ignores custom property declarations", async () => {
  await expect(
    assertRuleDoesNotReport(tokenOnly, tokenOnlyRuleName, ":root { --theme-color-accent: #ff0000; }"),
  ).resolves.toBeUndefined();
});

it("ignores unlisted properties", async () => {
  await expect(
    assertRuleDoesNotReport(tokenOnly, tokenOnlyRuleName, ".price { width: 12px; }"),
  ).resolves.toBeUndefined();
});

it("honours configured prefixes", async () => {
  await expect(
    assertRuleDoesNotReport(tokenOnly, tokenOnlyRuleName, ".price { color: var(--acme-text); }", {
      ruleOptions: { prefixes: ["--acme-"] },
    }),
  ).resolves.toBeUndefined();
});
