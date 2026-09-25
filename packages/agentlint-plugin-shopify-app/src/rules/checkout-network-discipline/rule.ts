import { defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { matchesPattern } from "../jsx-support.js";

const defaultNetworkCallPattern = /^(?:await\s+)?(?:(?:(?:window|globalThis|self)\.)?fetch|shopify\.query)\s*\(/;

export type CheckoutNetworkDisciplineOptions = {
  /**
   * Pattern matching network call expressions. Defaults to direct and
   * window/globalThis/self-qualified fetch and shopify.query; extend it if the extension uses a
   * project fetch wrapper.
   */
  readonly networkCallPattern?: RegExp;
};

/**
 * @attribution https://shopify.dev/docs/apps/build/checkout/extension-performance (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/checkout/capabilities (inspiration; independently implemented)
 */
export function defineCheckoutNetworkDiscipline(options: CheckoutNetworkDisciplineOptions = {}): StateRule {
  options = structuredClone(options);
  const networkCallPattern = options.networkCallPattern ?? defaultNetworkCallPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/checkout-network-discipline",
      revision: 2,
      title: "Checkout Network Discipline",
      summary: "Flags network calls in checkout extension code for latency-budget review.",
      guidance: {
        standard:
          "Checkout extensions should prefer Shopify-provided data, bound necessary network work, and render initial content without avoidable loading flashes.",
        checks: [
          "Data comes from metafields, metaobjects, extension settings, or checkout APIs before any app backend call.",
          "Bound remaining fetch and shopify.query calls with supported timeout or cancellation handling; parallelize independent requests and record measured response times against Shopify's checkout best-practice target below one second. Source code alone does not establish response latency.",
          "Load necessary initial data in the extension callback before first paint so Shopify's skeleton remains until a stable initial render; handle failure without an indefinite wait.",
          "Keep network work and expensive initialization out of module scope. Read reactive checkout data close to the component that displays it.",
          "The called backend verifies the session token and trusts only its signed claims; shop, customer, and cart identifiers sent in the request body or query string are treated as untrusted input.",
          "No buyer-callable endpoint returns or mutates sensitive data such as discount codes, customer records, or order details; extension code is public and anyone can replay its requests.",
          "The backend answers extension requests with `Access-Control-Allow-Origin: *`, and the extension declares `network_access` for external calls and `api_access` for Storefront API queries.",
          "An App Proxy request made from an extension does not carry `logged_in_customer_id`; buyer identity comes from the session token instead.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/build/checkout/extension-performance",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices#18-checkout-apps",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/build/checkout/capabilities" },
        ],
      },
    },
    binding: {
      id: "shopify-app/checkout-network-discipline",
      authority: "agent",
      include: ["extensions/**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts"],
      options: {
        networkCallPattern: options.networkCallPattern
          ? { source: options.networkCallPattern.source, flags: options.networkCallPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "extensions/payment/main.ts", source: 'fetch("https://api.test/")' }],
        mustStaySilent: [{ file: "extensions/payment/main.ts", source: "const id=1;" }],
      },
      id: "shopify-app/checkout-network-discipline",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            if (!matchesPattern(networkCallPattern, node.text)) return;
            context.report({
              node,
              message: "Network call in checkout extension code: verify it meets the checkout latency discipline.",
            });
          },
        };
      },
    },
  });
}

export const checkoutNetworkDiscipline = defineCheckoutNetworkDiscipline();
