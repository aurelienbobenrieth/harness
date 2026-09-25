import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/webhook-hmac-verification-shape";

const body = (compare: string) => `import { createHmac } from "node:crypto";
export function verify(rawBody, req, secret) {
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  return ${compare}(digest, req.get("x-shopify-hmac-sha256"));
}
`;

it("reports an HMAC computed over re-serialised JSON", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import crypto from "node:crypto";
export function verify(req, secret) {
  const digest = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(req.get("X-Shopify-Hmac-SHA256")));
}
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports re-serialised JSON fed to a stored hmac instance", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { createHmac, timingSafeEqual } from "node:crypto";
export function verify(req, secret) {
  const hmac = createHmac("sha256", secret);
  hmac.update(JSON.stringify(req.body));
  return timingSafeEqual(Buffer.from(hmac.digest("base64")), Buffer.from(req.headers["x-shopify-hmac-sha256"]));
}
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a raw-body digest compared without a timing-safe function", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { createHmac } from "node:crypto";
export function verify(rawBody, header, secret) {
  return createHmac("sha256", secret).update(rawBody).digest("base64") === header;
}
export const headerName = "x-shopify-hmac-sha256";
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts raw-body hashing with timingSafeEqual, safeCompare or a configured helper", async () => {
  await expect(assertRuleDoesNotReport(ruleName, body("timingSafeEqual"))).resolves.toBeUndefined();
  await expect(assertRuleDoesNotReport(ruleName, body("shopify.auth.safeCompare"))).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, body("constantTimeEquals"), {
      ruleOptions: { safeCompareNames: ["constantTimeEquals"] },
    }),
  ).resolves.toBeUndefined();
});

it("stays silent without the webhook header, without createHmac, and for other update calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createHmac } from "node:crypto";
export const oauthDigest = (query, secret) => createHmac("sha256", secret).update(JSON.stringify(query)).digest("hex") === query.hmac;
`,
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { verifyShopifyHmac } from "./verify.js";
export const handler = (req) => verifyShopifyHmac(req.rawBody, req.get("x-shopify-hmac-sha256"));
`,
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createHmac, timingSafeEqual } from "node:crypto";
export function verify(rawBody, req, secret, cache) {
  cache.update(JSON.stringify(req.body));
  const digest = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(digest, Buffer.from(req.get("x-shopify-hmac-sha256"), "base64"));
}
`,
    ),
  ).resolves.toBeUndefined();
});
