import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-dead-comments";

it("reports closing-brace labels", async () => {
  await expect(
    assertRuleReports(ruleName, "function load() {\n  return 1;\n} // end function load\n"),
  ).resolves.toBeUndefined();
});

it("reports bare end labels on closing braces", async () => {
  await expect(assertRuleReports(ruleName, "if (ready) {\n  run();\n} // end if\n")).resolves.toBeUndefined();
});

it("allows end-like comments away from closing braces", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "// close the connection before returning\nconnection.close();\n"),
  ).resolves.toBeUndefined();
});

it("reports placeholder scaffolding comments", async () => {
  await expect(assertRuleReports(ruleName, "// your code here\nexport const ready = true;\n")).resolves.toBeUndefined();
});

it("reports placeholder TODO comments", async () => {
  await expect(
    assertRuleReports(ruleName, "// TODO: implement this\nexport const ready = true;\n"),
  ).resolves.toBeUndefined();
});

it("reports bare TODO comments without an issue reference", async () => {
  await expect(
    assertRuleReports(ruleName, "// TODO: rename this contract\nexport const ready = true;\n"),
  ).resolves.toBeUndefined();
});

it("reports bare FIXME comments without an issue reference", async () => {
  await expect(
    assertRuleReports(ruleName, "// FIXME the rounding drifts on large carts\nexport const ready = true;\n"),
  ).resolves.toBeUndefined();
});

it("allows TODO comments with an issue number", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "// TODO(#123): rename this contract\nexport const ready = true;\n"),
  ).resolves.toBeUndefined();
});

it("allows TODO comments with a ticket key", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "// TODO CART-42: tighten the types\nexport const ready = true;\n"),
  ).resolves.toBeUndefined();
});

it("allows TODO comments with a link", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "// TODO: tracked in https://github.com/acme/shop/issues/9\nexport const ready = true;\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows HACK and NOTE constraint comments", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "// HACK: upstream parser drops the BOM\n// NOTE: totals are computed in cents\nexport const ready = true;\n",
    ),
  ).resolves.toBeUndefined();
});

it.each([
  "// Updated to use the new pricing API\nexport const ready = true;\n",
  "// NEW: retry with backoff\nexport const ready = true;\n",
  "// Fixed: off-by-one in pagination\nexport const ready = true;\n",
  "// Previously this used a Map keyed by id\nexport const ready = true;\n",
  "/* previously: fetched on every render */\nexport const ready = true;\n",
  "/**\n * Was: a synchronous read.\n */\nexport const ready = true;\n",
  "// Changed from a class to a factory\nexport const ready = true;\n",
  "// Now returns a Result instead of throwing\nexport const ready = true;\n",
  "// No longer supports the legacy token format\nexport const ready = true;\n",
  "// Added for the review feedback on null handling\nexport const ready = true;\n",
  "// Removed the cache as requested\nexport const ready = true;\n",
])("reports comments narrating a change: %s", async (source) => {
  await assertRuleReports(ruleName, source);
});

it.each([
  "/** Updated when the cache expires. */\nexport const ready = true;\n",
  "/**\n * Updated to the latest write timestamp on every save.\n */\nexport const ready = true;\n",
  "/** Now returns the cached entry while a refresh is in flight. */\nexport const ready = true;\n",
  "// New customers receive a welcome discount\nexport const ready = true;\n",
  "// Previously seen cursors are skipped to keep pagination idempotent\nexport const ready = true;\n",
  "// Added items keep insertion order because the UI renders them as a timeline\nexport const ready = true;\n",
  "// Removed entries are tombstoned per tenant retention policy\nexport const ready = true;\n",
  "// Timestamps are updated to UTC before comparison\nexport const ready = true;\n",
  "// Fixed-point math avoids float drift: amounts are integers in cents\nexport const ready = true;\n",
  "// Changed rows are flushed in one batch\nexport const ready = true;\n",
])("allows behavior descriptions that resemble narration: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source);
});
