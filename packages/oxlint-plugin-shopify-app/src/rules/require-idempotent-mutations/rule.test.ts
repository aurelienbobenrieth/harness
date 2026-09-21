import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";
import { idempotencyRequirement } from "./rule.js";

const ruleName = "shopify-app/require-idempotent-mutations";

it("keeps the reviewed mutation table dated and complete", () => {
  expect(idempotencyRequirement.mutations).toHaveLength(17);
  expect(new Set(idempotencyRequirement.mutations).size).toBe(17);
  expect(idempotencyRequirement.source).toMatch(/^https:\/\/shopify\.dev\/changelog\//);
  expect(idempotencyRequirement.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it("reports a listed mutation without the directive", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const document = `mutation($input: RefundInput!) { refundCreate(input: $input) { refund { id } userErrors { message } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports a literal idempotency key even for projects pinned before the requirement", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const document = `mutation($input: RefundInput!) { refundCreate(input: $input) @idempotent(key: "4f5b6ebf-143c-4da5-8d0f-fb8553bfd85d") { refund { id } } }`;\n',
      { ruleOptions: { since: "2026-01" } },
    ),
  ).resolves.toBeUndefined();
});

it("accepts a variable key", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const document = `mutation($input: RefundInput!, $key: String!) { refundCreate(input: $input) @idempotent(key: $key) { refund { id } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores unlisted mutations, queries naming the field, and directives on the operation only", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const a = `mutation { productCreate { product { id } } }`;\nconst b = `query { refundCreate: node(id: 1) { id } }`;\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const document = `mutation M($key: String!) @idempotent(key: $key) { inventoryActivate(inventoryItemId: 1, locationId: 2) { userErrors { message } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("silences the missing directive for projects pinned before 2026-04 only", async () => {
  const code = "const document = `mutation { locationDeactivate(locationId: 1) { userErrors { message } } }`;\n";
  await expect(assertRuleDoesNotReport(ruleName, code, { ruleOptions: { since: "2026-01" } })).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, code, { ruleOptions: { since: "2026-07" } })).resolves.toBeUndefined();
});
