import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-draft-order-custom-discounts";

it("reports draftOrderCreate documents with appliedDiscount", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const mutation = `mutation { draftOrderCreate(input: { appliedDiscount: { value: 10.0 } }) { draftOrder { id } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports draftOrderUpdate documents with appliedDiscount", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const mutation = `mutation draftOrderUpdate($input: DraftOrderInput!) { draftOrderUpdate(input: { appliedDiscount: { value: 10 } }) { draftOrder { appliedDiscount { value } } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores draft order documents without custom discounts", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const mutation = `mutation { draftOrderCreate(input: { email: $email }) { draftOrder { id } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores appliedDiscount outside draft order documents", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const field = `appliedDiscount { value }`;\n"),
  ).resolves.toBeUndefined();
});

it("does not mistake response selections or prose for mutation inputs", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "const query = `mutation { draftOrderUpdate(input: $input) { draftOrder { appliedDiscount { value } } } }`;",
  );
  await assertRuleDoesNotReport(ruleName, 'const help = "draftOrderCreate can return appliedDiscount";');
});
