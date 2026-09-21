import { createHmac } from "node:crypto";
import type { ConformanceFinding } from "./finding.js";

const iframeDocs = "https://shopify.dev/docs/apps/build/security/set-up-iframe-protection";
const webhookDocs = "https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance";

export type ShopifyIframeProtectionOptions =
  | {
      readonly response: Response;
      readonly embedded: true;
      /** Obtain this identity from verified application authentication, never an unchecked request parameter. */
      readonly authenticatedShopDomain: string;
    }
  | { readonly response: Response; readonly embedded: false };

/**
 * Checks one supplied HTML response's enforced header against Shopify's documented policy shape.
 * The caller owns route coverage and authentication. Multiple policies without frame-ancestors are allowed;
 * every policy that declares it must use the exact expected origins, without duplicate directives.
 * @attribution https://shopify.dev/docs/apps/build/security/set-up-iframe-protection (inspiration; independently implemented)
 */
export function evaluateShopifyIframeProtection(
  options: ShopifyIframeProtectionOptions,
): readonly ConformanceFinding[] {
  const expected = new Set(
    options.embedded
      ? ["https://admin.shopify.com", `https://${validatedShopDomain(options.authenticatedShopDomain)}`]
      : ["'none'"],
  );
  const severity = options.embedded ? "error" : "warning";
  const finding = (message: string): ConformanceFinding => ({
    check: "iframe-protection",
    severity,
    docs: iframeDocs,
    message,
  });
  const header = options.response.headers.get("content-security-policy");
  if (header === null || header.trim() === "")
    return [
      finding(
        "Set an enforced Content-Security-Policy frame-ancestors response header. Report-only policies and HTML meta tags do not establish iframe protection.",
      ),
    ];
  if (!/^[\t\x20-\x7e]*$/u.test(header))
    return [
      finding(
        "Use ASCII Content-Security-Policy syntax and ordinary spaces or tabs. Nonstandard whitespace must not disguise a missing directive.",
      ),
    ];
  const findings: ConformanceFinding[] = [];
  let declarations = 0;
  for (const policy of header.split(",")) {
    const directives = policy
      .split(";")
      .map((directive) => directive.trim().split(/\s+/u))
      .filter((tokens) => tokens[0]?.toLowerCase() === "frame-ancestors");
    if (directives.length === 0) continue;
    declarations += directives.length;
    if (directives.length !== 1) {
      findings.push(
        finding(
          "Declare frame-ancestors once per enforced policy. Duplicate directives are ambiguous to reviewers and do not override an earlier value.",
        ),
      );
      continue;
    }
    const sources = directives[0]?.slice(1) ?? [];
    if (
      sources.length !== expected.size ||
      new Set(sources).size !== expected.size ||
      sources.some((source) => !expected.has(source))
    )
      findings.push(
        finding(
          options.embedded
            ? "Restrict frame-ancestors to the authenticated shop's HTTPS origin and https://admin.shopify.com. Remove wildcard, self, extra-tenant, and unrelated origins."
            : "For a standalone app, use frame-ancestors 'none' as Shopify recommends.",
        ),
      );
  }
  if (declarations === 0)
    findings.push(
      finding(
        "Declare frame-ancestors in the enforced Content-Security-Policy header. default-src does not provide this protection.",
      ),
    );
  return findings;
}

function validatedShopDomain(value: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/u.test(value))
    throw new Error(
      "authenticatedShopDomain must be a canonical shop-name.myshopify.com domain from verified authentication.",
    );
  return value;
}

export type ShopifyWebhookHmacProbeOptions = {
  /** A local handler wired to isolated fixture dependencies. The helper itself performs no network requests. */
  readonly handleRequest: (request: Request) => Response | Promise<Response>;
  /** A POST request with a valid JSON fixture body, shop domain, and one privacy compliance topic. */
  readonly request: Request;
  /** The test secret configured on the handler. Never use a production credential in a checked-in fixture. */
  readonly fixtureSigningSecret: string;
};

/**
 * Exercises a valid signed control and three invalid requests against a caller-supplied local handler.
 * Acceptance is a 2xx control response and exactly 401 for missing, malformed, and body-mismatched HMAC.
 * This does not prove timing safety, absence of side effects, privacy processing, or live delivery.
 * @attribution https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/webhooks/verify-deliveries (inspiration; independently implemented)
 */
export async function probeShopifyWebhookHmac(
  options: ShopifyWebhookHmacProbeOptions,
): Promise<readonly ConformanceFinding[]> {
  if (options.fixtureSigningSecret.length === 0)
    throw new Error("fixtureSigningSecret must be a nonempty isolated test secret.");
  if (options.request.method !== "POST") throw new Error("The webhook fixture request must use POST.");
  const topic = options.request.headers.get("x-shopify-topic");
  if (topic === null || !["customers/data_request", "customers/redact", "shop/redact"].includes(topic))
    throw new Error("The webhook fixture must name one of the three privacy compliance topics in X-Shopify-Topic.");
  validatedShopDomain(options.request.headers.get("x-shopify-shop-domain") ?? "");
  const body = await options.request.clone().text();
  try {
    JSON.parse(body);
  } catch {
    throw new Error("The webhook fixture body must contain valid JSON.");
  }
  const signature = createHmac("sha256", options.fixtureSigningSecret).update(body, "utf8").digest("base64");
  const cases = [
    { name: "valid-control", body, signature },
    { name: "missing-hmac", body, signature: undefined },
    { name: "malformed-hmac", body, signature: "invalid-hmac" },
    { name: "body-mismatched-hmac", body: `${body}\n`, signature },
  ] as const;
  const findings: ConformanceFinding[] = [];
  for (const test of cases) {
    const headers = new Headers(options.request.headers);
    headers.delete("content-length");
    headers.delete("x-shopify-hmac-sha256");
    if (test.signature !== undefined) headers.set("x-shopify-hmac-sha256", test.signature);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    const request = new Request(options.request.url, { method: "POST", headers, body: test.body });
    let response: Response;
    try {
      response = await options.handleRequest(request);
    } catch {
      findings.push({
        check: "webhook-hmac",
        docs: webhookDocs,
        severity: "error",
        message: `${test.name}: the injected handler threw instead of returning an HTTP response. Exercise the complete request adapter.`,
      });
      continue;
    }
    const passed =
      test.name === "valid-control" ? response.status >= 200 && response.status < 300 : response.status === 401;
    if (!passed)
      findings.push({
        check: "webhook-hmac",
        docs: webhookDocs,
        severity: "error",
        message: `${test.name}: expected ${test.name === "valid-control" ? "a successful 2xx control response" : "HTTP 401"}, received HTTP ${response.status}. Verify raw-body HMAC authentication before processing the webhook.`,
      });
  }
  return findings;
}
