import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineWebhookHandlerReview, webhookHandlerReview } from "./rule.js";

it("reports an authenticate.webhook route once, even with several signals", async () => {
  const findings = await testRuleOnSource(
    webhookHandlerReview,
    `
export const action = async ({ request }) => {
  const { topic, shop, session } = await shopify.authenticate.webhook(request);
  switch (topic) {
    case "APP_UNINSTALLED": await db.session.deleteMany({ where: { shop } }); break;
    case "CUSTOMERS_REDACT": console.log("redact"); break;
  }
  return new Response();
};
`,
    "app/routes/webhooks.tsx",
  );
  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [3, expect.stringContaining("authenticate.webhook call")],
  ]);
});

it("reports custom-server handlers through the delivery headers", async () => {
  const findings = await testRuleOnSource(
    webhookHandlerReview,
    'app.post("/webhooks", (req, res) => { const id = req.get("X-Shopify-Webhook-Id"); res.sendStatus(200); });',
    "server/webhooks.ts",
  );
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("X-Shopify-Webhook-Id header")]);
});

it("reports topic comparisons in both topic spellings", async () => {
  const findings = await Promise.all(
    [
      'if (topic === "orders/create") { await fulfil(payload); }',
      'if ("INVENTORY_LEVELS_UPDATE" != topic) return;',
    ].map((source) => testRuleOnSource(webhookHandlerReview, source, "server/dispatch.ts")),
  );
  expect(findings.map((found) => found.length)).toEqual([1, 1]);
});

it("stays silent on admin authentication, unrelated headers, and non-branch topic strings", async () => {
  const findings = await testRuleOnSource(
    webhookHandlerReview,
    `
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const shop = request.headers.get("X-Shopify-Shop-Domain");
  if (request.headers.get("content-type") === "application/json") track("orders/create");
  return navigate("/orders/create");
};
`,
    "app/routes/app.orders.tsx",
  );
  expect(findings).toEqual([]);
});

it("uses a replacement topic pattern", async () => {
  const rule = defineWebhookHandlerReview({ topicPattern: /^returns\/[a-z_]+$/g });
  const source = 'if (topic === "returns/approve") { a(); }';
  expect(await testRuleOnSource(rule, source, "server/dispatch.ts")).toHaveLength(1);
  expect(await testRuleOnSource(rule, source, "server/dispatch.ts")).toHaveLength(1);
  expect(await testRuleOnSource(webhookHandlerReview, source, "server/dispatch.ts")).toEqual([]);
});
