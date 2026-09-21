import { createHmac, timingSafeEqual } from "node:crypto";
import { expect, it } from "vitest";
import { evaluateShopifyIframeProtection, probeShopifyWebhookHmac } from "./http-contracts.js";

const shop = "fixture-store.myshopify.com";
const correct = `frame-ancestors https://${shop} https://admin.shopify.com;`;

function evaluate(policy: string) {
  return evaluateShopifyIframeProtection({
    response: new Response("<html></html>", { headers: { "content-security-policy": policy } }),
    embedded: true,
    authenticatedShopDomain: shop,
  });
}

it("accepts a tenant-specific enforced policy with unrelated directives or additional non-framing policies", () => {
  expect(evaluate(`default-src 'self'; ${correct}`)).toEqual([]);
  expect(evaluate(`${correct}, default-src 'none'`)).toEqual([]);
  expect(evaluate(`FRAME-ANCESTORS https://admin.shopify.com https://${shop}`)).toEqual([]);
});

it.each([
  "default-src 'none'",
  "frame-ancestors *",
  "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
  "frame-ancestors 'self'",
  "frame-ancestors 'none'",
  `frame-ancestors https://other.myshopify.com https://admin.shopify.com`,
  `${correct} frame-ancestors *;`,
  `frame-ancestors *; ${correct}`,
  `${correct}, frame-ancestors *`,
  `frame-ancestors https://${shop} https://admin.shopify.com https://attacker.example`,
  `frame-ancestors http://${shop} https://admin.shopify.com`,
  "frame-ancestors",
])("rejects missing, overbroad, duplicate, or tenant-mismatched policies: %s", (policy) => {
  expect(evaluate(policy)).not.toEqual([]);
});

it("does not accept report-only or a meta tag as enforced protection", () => {
  const response = new Response(`<meta http-equiv="Content-Security-Policy" content="${correct}">`, {
    headers: { "content-security-policy-report-only": correct },
  });
  expect(evaluateShopifyIframeProtection({ response, embedded: true, authenticatedShopDomain: shop })).toEqual([
    expect.objectContaining({ severity: "error" }),
  ]);
});

it("rejects duplicated origins and non-ASCII separators that browsers do not parse as CSP whitespace", () => {
  expect(evaluate(`frame-ancestors https://${shop} https://${shop}`)).toHaveLength(1);
  expect(evaluate(`frame-ancestors\u00a0https://${shop} https://admin.shopify.com`)).toHaveLength(1);
});

it("tests a second shop separately instead of treating the first shop's header as global evidence", () => {
  const response = new Response(null, { headers: { "content-security-policy": correct } });
  expect(
    evaluateShopifyIframeProtection({
      response,
      embedded: true,
      authenticatedShopDomain: "second-store.myshopify.com",
    }),
  ).toHaveLength(1);
});

it("treats the standalone policy as a recommendation", () => {
  expect(evaluateShopifyIframeProtection({ response: new Response(null), embedded: false })).toEqual([
    expect.objectContaining({ severity: "warning" }),
  ]);
  expect(
    evaluateShopifyIframeProtection({
      response: new Response(null, {
        headers: { "content-security-policy": "frame-ancestors 'none'" },
      }),
      embedded: false,
    }),
  ).toEqual([]);
});

it.each([
  "https://fixture-store.myshopify.com",
  "store.myshopify.com.attacker.example",
  "*.myshopify.com",
  "store.myshopify.com:443",
  "store.myshopify.com/path",
])("rejects an invalid authenticated shop identity: %s", (authenticatedShopDomain) => {
  expect(() =>
    evaluateShopifyIframeProtection({
      response: new Response(null),
      embedded: true,
      authenticatedShopDomain,
    }),
  ).toThrow("authenticatedShopDomain");
});

const fixtureSigningSecret = "local-test-secret";
function fixtureRequest(): Request {
  return new Request("http://localhost/webhooks/privacy", {
    method: "POST",
    headers: { "x-shopify-topic": "shop/redact", "x-shopify-shop-domain": shop },
    body: JSON.stringify({ shop_id: 1, shop_domain: shop }),
  });
}

async function verifiedHandler(request: Request): Promise<Response> {
  const body = await request.text();
  const digest = createHmac("sha256", fixtureSigningSecret).update(body).digest();
  const supplied = Buffer.from(request.headers.get("x-shopify-hmac-sha256") ?? "", "base64");
  return new Response(null, {
    status: supplied.length === digest.length && timingSafeEqual(digest, supplied) ? 204 : 401,
  });
}

it("exercises a valid control and rejects absent, malformed, and raw-body-mismatched HMAC", async () => {
  const seen: Request[] = [];
  const findings = await probeShopifyWebhookHmac({
    request: fixtureRequest(),
    fixtureSigningSecret,
    handleRequest: (request) => {
      seen.push(request.clone());
      return verifiedHandler(request);
    },
  });
  expect(findings).toEqual([]);
  expect(seen).toHaveLength(4);
  expect(await seen[0]?.text()).not.toEqual(await seen[3]?.text());
});

it("fails an always-rejecting handler so broken routing cannot masquerade as authentication", async () => {
  const findings = await probeShopifyWebhookHmac({
    request: fixtureRequest(),
    fixtureSigningSecret,
    handleRequest: () => new Response(null, { status: 401 }),
  });
  expect(findings).toEqual([expect.objectContaining({ message: expect.stringContaining("valid-control") })]);
});

it("fails an always-accepting handler for all three invalid signatures", async () => {
  expect(
    await probeShopifyWebhookHmac({
      request: fixtureRequest(),
      fixtureSigningSecret,
      handleRequest: () => new Response(null, { status: 200 }),
    }),
  ).toHaveLength(3);
});

it("catches handlers that trust a nonempty HMAC without checking raw bytes", async () => {
  const findings = await probeShopifyWebhookHmac({
    request: fixtureRequest(),
    fixtureSigningSecret,
    handleRequest: (request) =>
      new Response(null, { status: request.headers.has("x-shopify-hmac-sha256") ? 200 : 401 }),
  });
  expect(findings).toHaveLength(2);
});

it("reports thrown handler failures without copying private error text", async () => {
  const findings = await probeShopifyWebhookHmac({
    request: fixtureRequest(),
    fixtureSigningSecret,
    handleRequest: () => {
      throw new Error("private payload");
    },
  });
  expect(findings).toHaveLength(4);
  expect(JSON.stringify(findings)).not.toContain("private payload");
});

it("rejects malformed fixture inputs before exercising the handler", async () => {
  await expect(
    probeShopifyWebhookHmac({
      request: fixtureRequest(),
      fixtureSigningSecret: "",
      handleRequest: verifiedHandler,
    }),
  ).rejects.toThrow("fixtureSigningSecret");
  await expect(
    probeShopifyWebhookHmac({
      request: new Request("http://localhost"),
      fixtureSigningSecret,
      handleRequest: verifiedHandler,
    }),
  ).rejects.toThrow("POST");
});
