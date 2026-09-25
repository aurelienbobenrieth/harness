import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-hardcoded-billing-test-mode";

it("reports literal isTest: true in billing calls", async () => {
  await expect(
    assertRuleReports(ruleName, "await billing.require({ plans: [PRO], isTest: true, onFailure });\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "await context.billing.request({ plan: PRO, isTest: true });\n"),
  ).resolves.toBeUndefined();
});

it("reports literal test: true on charge mutations", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const document = `mutation { appSubscriptionCreate(name: "Pro", returnUrl: "https://example.com", test: true, lineItems: []) { confirmationUrl userErrors { message } } }`;\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts derived flags, false, variables and unrelated owners", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'await billing.require({ plans: [PRO], isTest: process.env.NODE_ENV !== "production", onFailure });',
        "await billing.request({ plan: PRO, isTest: false });",
        "await billing.request({ plan: PRO, isTest });",
        "await payments.request({ isTest: true });",
        "await billing.updateUsageCappedAmount({ isTest: true });",
        "configure({ isTest: true });",
        'const a = `mutation($test: Boolean) { appPurchaseOneTimeCreate(name: "x", test: $test, returnUrl: "https://example.com", price: { amount: 1, currencyCode: USD }) { userErrors { message } } }`;',
        'const b = `mutation { appSubscriptionCreate(name: "Pro", returnUrl: "https://example.com", test: false, lineItems: []) { userErrors { message } } }`;',
        "const c = `mutation { productCreate(test: true) { userErrors { message } } }`;",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("skips test files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "await billing.request({ plan: PRO, isTest: true });\n", {
      filename: "app/billing.test.ts",
    }),
  ).resolves.toBeUndefined();
});
