import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-viewport-zoom-disable";
const filename = "sample.tsx";

it("reports viewport meta blocking zoom via user-scalable", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export const head = <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />;\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("reports viewport meta blocking zoom via maximum-scale", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export const head = <meta name="viewport" content="width=device-width, maximum-scale=1" />;\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("ignores standard viewport meta", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'export const head = <meta name="viewport" content="width=device-width, initial-scale=1" />;\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("ignores other meta tags", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'export const head = <meta name="description" content="App" />;\n', {
      filename,
    }),
  ).resolves.toBeUndefined();
});
