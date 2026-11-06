import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineWebhookHandlerReview, webhookHandlerReview } from "./rule.js";

it("reports an authenticate.webhook route once, even with several signals", async () => {
  const findings = await testRuleOnSource({
    rule: webhookHandlerReview,
    source: `
export const action = async ({ request }) => {
  const { topic, shop, session } = await shopify.authenticate.webhook(request);
  switch (topic) {
    case "APP_UNINSTALLED": await db.session.deleteMany({ where: { shop } }); break;
    case "CUSTOMERS_REDACT": console.log("redact"); break;
  }
  return new Response();
};
`,
    file: "app/routes/webhooks.tsx",
  });
  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [3, expect.stringContaining("authenticate.webhook call")],
  ]);
});

it("reports custom-server handlers through the delivery headers", async () => {
  const findings = await testRuleOnSource({
    rule: webhookHandlerReview,
    source:
      'app.post("/webhooks", (req, res) => { const id = req.get("X-Shopify-Webhook-Id"); res.sendStatus(200); });',
    file: "server/webhooks.ts",
  });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("X-Shopify-Webhook-Id header")]);
});

it("reports topic comparisons in both topic spellings", async () => {
  const findings = await Promise.all(
    [
      'if (topic === "orders/create") { await fulfil(payload); }',
      'if ("INVENTORY_LEVELS_UPDATE" != topic) return;',
    ].map((source) => testRuleOnSource({ rule: webhookHandlerReview, source: source, file: "server/dispatch.ts" })),
  );
  expect(findings.map((found) => found.length)).toEqual([1, 1]);
});

it("stays silent on admin authentication, unrelated headers, and non-branch topic strings", async () => {
  const findings = await testRuleOnSource({
    rule: webhookHandlerReview,
    source: `
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const shop = request.headers.get("X-Shopify-Shop-Domain");
  if (request.headers.get("content-type") === "application/json") track("orders/create");
  return navigate("/orders/create");
};
`,
    file: "app/routes/app.orders.tsx",
  });
  expect(findings).toEqual([]);
});

it("uses a replacement topic pattern", async () => {
  const rule = defineWebhookHandlerReview({ topicPattern: /^returns\/[a-z_]+$/g });
  const source = 'if (topic === "returns/approve") { a(); }';
  expect(await testRuleOnSource({ rule: rule, source: source, file: "server/dispatch.ts" })).toHaveLength(1);
  expect(await testRuleOnSource({ rule: rule, source: source, file: "server/dispatch.ts" })).toHaveLength(1);
  expect(
    await testRuleOnSource({
      rule: webhookHandlerReview,
      source: source,
      file: "server/dispatch.ts",
    }),
  ).toEqual([]);
});

it("stays silent on a handler that only authenticates, logs, and returns", async () => {
  const findings = await testRuleOnSource({
    rule: webhookHandlerReview,
    source: `
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log("Received", topic, "Event for", shop);
  console.log(JSON.stringify(payload, null, 2));
  return new Response(null, { status: 200 });
};
`,
    file: "app/routes/webhooks.products.update.tsx",
  });
  expect(findings).toEqual([]);
});

it("still reports a handler that writes to a database or branches on session", async () => {
  const findings = await testRuleOnSource({
    rule: webhookHandlerReview,
    source: `
export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(topic);
  if (session) await db.session.deleteMany({ where: { shop } });
  return new Response();
};
`,
    file: "app/routes/webhooks.app.uninstalled.tsx",
  });
  expect(findings).toHaveLength(1);
});

it("never treats a compliance-topic handler as trivial", async () => {
  const findings = await testRuleOnSource({
    rule: webhookHandlerReview,
    source: `
export const action = async ({ request }) => {
  const { topic } = await authenticate.webhook(request); // customers/redact
  console.log(topic);
  return new Response();
};
`,
    file: "app/routes/webhooks.customers.redact.tsx",
  });
  expect(findings).toHaveLength(1);
});
