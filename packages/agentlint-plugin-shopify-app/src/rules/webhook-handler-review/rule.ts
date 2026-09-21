import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { matchesPattern } from "../jsx-support.js";

const authenticateWebhookPattern = /(?:^|\.)authenticate\.webhook$/;
const webhookHeaderPattern = /^x-shopify-(?:hmac-sha256|topic|webhook-id)$/i;
const topicResources = [
  "app",
  "app_subscriptions",
  "bulk_operations",
  "carts",
  "checkouts",
  "collections",
  "customers",
  "draft_orders",
  "fulfillments",
  "inventory_items",
  "inventory_levels",
  "orders",
  "products",
  "refunds",
  "shop",
  "subscription_contracts",
  "themes",
].join("|");
const defaultTopicPattern = new RegExp(
  `^(?:(?:${topicResources})/[a-z_]+|(?:${topicResources.toUpperCase()})_[A-Z_]+)$`,
);

export type WebhookHandlerReviewOptions = {
  /**
   * Pattern tested against the unquoted value of a string literal used as a `switch` case or a
   * comparison operand. Defaults to common Admin webhook topics in both `orders/create` and
   * `ORDERS_CREATE` forms; replace it when the app subscribes to other resources.
   */
  readonly topicPattern?: RegExp;
};

function literalValue(node: AgentlintNode): string {
  return node.text.slice(1, -1);
}

function isBranchOperand(node: AgentlintNode): boolean {
  const parent = node.parent;
  if (parent?.type === "switch_case") return true;
  return parent?.type === "binary_expression" && /^[!=]==?$/.test(parent.childByFieldName("operator")?.text ?? "");
}

/**
 * @attribution https://shopify.dev/docs/apps/build/webhooks/subscribe/https (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/webhooks/ignore-duplicates (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/webhooks/best-practices (inspiration; independently implemented)
 */
export function defineWebhookHandlerReview(options: WebhookHandlerReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const topicPattern = options.topicPattern ?? defaultTopicPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/webhook-handler-review",
      revision: 1,
      title: "Webhook Handler Review",
      summary:
        "Flags Shopify webhook handlers once per file for response-time, duplicate-delivery, ordering, uninstall, and compliance review.",
      guidance: {
        standard:
          "Shopify waits five seconds in total for a webhook response, treats every non-2xx status (redirects included) as a failure, retries eight times over four hours, and then deletes API-created subscriptions. Deliveries can repeat, arrive out of order, or never arrive, and they can fire after uninstall when no session exists. Pass when every applicable check below holds; constant-time database work done inline (for example deleting sessions on app/uninstalled) is acceptable and needs no queue.",
        checks: [
          "Duplicates: side effects are guarded by a persisted `X-Shopify-Webhook-Id` (the `webhookId` returned by `authenticate.webhook`) recorded before they run, or the processing is demonstrably idempotent such as an upsert keyed by GID. `X-Shopify-Event-Id` only correlates deliveries of one merchant action across subscriptions.",
          "Response time: Admin API calls, third-party requests, email, and other slow work are enqueued or deferred and the 2xx response is returned first; inline work is limited to a bounded number of database writes.",
          "Ordering: where a later event must not be overwritten by an earlier one, the handler compares `X-Shopify-Triggered-At` or the payload's `updated_at` with stored state before writing.",
          "Uninstall: when `session` or `admin` is undefined the handler returns 2xx without throwing and without calling the Admin API.",
          "Compliance: `customers/data_request`, `customers/redact`, and `shop/redact` perform or schedule the real export or deletion; a handler that only logs does not pass.",
          "Status codes: a non-2xx response is returned only when a retry is wanted; permanent failures such as an unknown topic or an invalid payload are recorded and acknowledged with 2xx.",
          "Signature: a handler that does not use `authenticate.webhook` verifies the HMAC over the raw request body with a timing-safe comparison before parsing.",
          "Privacy: payloads carrying customer data are not logged wholesale; logs keep identifiers and the topic only.",
          "Reconciliation: data that must stay consistent has a periodic job filtering on `updated_at`, because delivery is not guaranteed.",
        ],
        refs: [
          { type: "url", href: "https://shopify.dev/docs/apps/build/webhooks/subscribe/https" },
          { type: "url", href: "https://shopify.dev/docs/apps/build/webhooks/ignore-duplicates" },
          { type: "url", href: "https://shopify.dev/docs/apps/build/webhooks/best-practices" },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/webhook",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/launch/protected-customer-data" },
        ],
      },
    },
    binding: {
      id: "shopify-app/webhook-handler-review",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.{ts,tsx,js,jsx}", "**/__tests__/**"],
      options: {
        topicPattern: options.topicPattern
          ? { source: options.topicPattern.source, flags: options.topicPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "app/routes/webhooks.app.uninstalled.tsx",
            source: "export const action = async ({ request }) => { await authenticate.webhook(request); };",
          },
          { file: "server/webhooks.ts", source: 'const hmac = req.get("X-Shopify-Hmac-Sha256");' },
          { file: "server/webhooks.ts", source: 'switch (topic) { case "ORDERS_CREATE": break; }' },
        ],
        mustStaySilent: [
          {
            file: "app/routes/app._index.tsx",
            source: "export const loader = async ({ request }) => { await authenticate.admin(request); };",
          },
          {
            file: "server/http.ts",
            source: 'if (type === "application/json") { accept("orders/create"); }',
          },
        ],
      },
      id: "shopify-app/webhook-handler-review",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        let reported = false;
        const report = (node: AgentlintNode, signal: string): void => {
          if (reported) return;
          reported = true;
          context.report({
            node,
            key: "webhook-handler",
            message: `Shopify webhook handling detected (${signal}): verify duplicate-delivery protection, a response inside the five-second window, the uninstalled-shop path, and real compliance processing.`,
          });
        };
        return {
          before: () => {
            reported = false;
          },
          call_expression(node) {
            const callee = node.childByFieldName("function");
            if (callee && authenticateWebhookPattern.test(callee.text)) report(node, "authenticate.webhook call");
          },
          string(node) {
            const value = literalValue(node);
            if (webhookHeaderPattern.test(value)) report(node, `${value} header`);
            else if (isBranchOperand(node) && matchesPattern(topicPattern, value))
              report(node, `${value} topic branch`);
          },
        };
      },
    },
  });
}

export const webhookHandlerReview = defineWebhookHandlerReview();
