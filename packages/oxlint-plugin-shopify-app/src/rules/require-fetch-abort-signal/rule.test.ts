import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/require-fetch-abort-signal";

it("reports fetch without options", async () => {
  await expect(
    assertRuleReports(ruleName, 'await fetch("https://api.example.com/config");\n'),
  ).resolves.toBeUndefined();
});

it("reports fetch options without signal", async () => {
  await expect(
    assertRuleReports(ruleName, 'await fetch("https://api.example.com/config", { method: "POST" });\n'),
  ).resolves.toBeUndefined();
});

it("reports window-qualified fetch without signal", async () => {
  await expect(
    assertRuleReports(ruleName, 'await window.fetch("https://api.example.com/config");\n'),
  ).resolves.toBeUndefined();
});

it("ignores fetch with an AbortSignal", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'await fetch("https://api.example.com/config", { signal: AbortSignal.timeout(1000) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("enforces corrected contract: ignores fetch with spread options", async () => {
  await expect(
    assertRuleReports(ruleName, 'await fetch("https://api.example.com/config", { ...requestInit });\n'),
  ).resolves.toBeUndefined();
});

it('reports regression: fetch("/api", undefined);', async () => {
  await assertRuleReports(ruleName, 'fetch("/api", undefined);');
});

it('reports regression: fetch("/api", {signal: undefined});', async () => {
  await assertRuleReports(ruleName, 'fetch("/api", {signal: undefined});');
});

it('reports regression: fetch("/api", {signal: controller.signal, ...options});', async () => {
  await assertRuleReports(ruleName, 'fetch("/api", {signal: controller.signal, ...options});');
});

it('accepts regression: fetch(new Request("/api", {signal: controller.signal}));', async () => {
  await assertRuleDoesNotReport(ruleName, 'fetch(new Request("/api", {signal: controller.signal}));');
});
