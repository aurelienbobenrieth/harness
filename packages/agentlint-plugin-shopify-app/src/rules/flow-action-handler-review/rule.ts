import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { matchesPattern, serializedPattern } from "../jsx-support.js";

const authenticateFlowPattern = /(?:^|\.)authenticate\.flow$/;
/** Keys only the Flow action runtime request carries; preview and validation requests have neither. */
const runtimePayloadKeys = new Set(["action_run_id", "action_definition_id"]);

export type FlowActionHandlerReviewOptions = {
  /**
   * Repository-relative path pattern for Flow action `runtime_url` handlers that delegate payload
   * handling elsewhere. Matching files are reviewed even without a payload signal. Unset by default.
   */
  readonly handlerPathPattern?: RegExp;
};

/**
 * @attribution https://shopify.dev/docs/apps/build/flow/actions/endpoints (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/flow/actions/create (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/flow/configure-complex-data-types (inspiration; independently implemented)
 */
export function defineFlowActionHandlerReview(options: FlowActionHandlerReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const handlerPathPattern = options.handlerPathPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/flow-action-handler-review",
      revision: 1,
      title: "Flow Action Handler Review",
      summary:
        "Flags Shopify Flow action runtime handlers once per file for signature, duplicate-run, response-time, status-code, and return-value review.",
      guidance: {
        standard:
          "Flow POSTs each action run to the extension's `runtime_url` and waits at most ten seconds for a status. It resends the same run (same `action_run_id`) after a timeout, a 202, a 5xx, or a 429, at increasing intervals for up to 36 hours; any other 4xx is a final failure whose response body the merchant sees. Pass when every applicable check below holds; a handler that finishes well inside the budget and returns 200 needs no queue.",
        checks: [
          "Signature: the request goes through `authenticate.flow`, or the handler verifies `X-Shopify-Hmac-SHA256` over the raw body with the app secret and a timing-safe comparison before parsing, and rejects failures without side effects.",
          "Identity: the payload `handle` matches the action this endpoint serves, and the shop comes from the verified payload (`shop_id` / `shopify_domain`), not from a query string.",
          "Duplicate runs: side effects are keyed on `action_run_id`, recorded before or atomically with the work, so a resent run returns the stored outcome instead of repeating it.",
          "Response time: work that can exceed ten seconds (Admin API loops, third-party calls, email) is queued and answered with 202; a resent run returns 202 while pending and 200 once done.",
          "Status codes: transient failures return 5xx, or 429 with a `Retry-After` of 5 to 3600 seconds when rate limited; other 4xx only for permanent failures such as invalid merchant input, with a short body the merchant can act on and no internal details.",
          'Return value: when the action declares `return_type_ref`, the 200 body is `{"return_value": …}` matching the schema, with every non-nullable field present and under 50 KB; a mismatch fails the run transiently.',
          "Inputs: `properties` are read by the keys declared in the extension's settings fields, and missing or malformed values take the permanent-failure path instead of throwing.",
        ],
        refs: [
          { type: "url", href: "https://shopify.dev/docs/apps/build/flow/actions/endpoints" },
          { type: "url", href: "https://shopify.dev/docs/apps/build/flow/actions/create" },
          { type: "url", href: "https://shopify.dev/docs/apps/build/flow/configure-complex-data-types" },
        ],
      },
    },
    binding: {
      id: "shopify-app/flow-action-handler-review",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.{ts,tsx,js,jsx}", "**/__tests__/**"],
      options: { handlerPathPattern: serializedPattern(handlerPathPattern) },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "app/routes/api.flow.actions.place-bid.tsx",
            source:
              "export const action = async ({ request }) => { const { payload } = await authenticate.flow(request); return new Response(); };",
          },
          { file: "server/flow.ts", source: "const { action_run_id, properties } = await readBody(req);" },
          { file: "server/flow.ts", source: 'const runId = body["action_run_id"];' },
        ],
        mustStaySilent: [
          {
            file: "app/routes/webhooks.tsx",
            source: "export const action = async ({ request }) => { await authenticate.webhook(request); };",
          },
          {
            file: "server/flow-preview.ts",
            source: "const { step_reference, properties } = body; return { label_text: properties.name };",
          },
          { file: "server/log.ts", source: 'log("action_run_id missing"); const run = { id: actionRunId };' },
        ],
      },
      id: "shopify-app/flow-action-handler-review",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        let reported = false;
        const report = (node: AgentlintNode, signal: string): void => {
          if (reported) return;
          reported = true;
          context.report({
            node,
            key: "flow-action-handler",
            message: `Shopify Flow action handling detected (${signal}): verify signature checks, dedup on action_run_id, a status inside ten seconds (202 for longer work), and 4xx only for permanent failures.`,
          });
        };
        const payloadKey = (node: AgentlintNode): void => {
          if (runtimePayloadKeys.has(node.text)) report(node, `${node.text} payload key`);
        };
        return {
          before: () => {
            reported = false;
          },
          program(node) {
            if (handlerPathPattern && matchesPattern(handlerPathPattern, context.path.replaceAll("\\", "/")))
              report(node, "configured handler path");
          },
          call_expression(node) {
            const callee = node.childByFieldName("function");
            if (callee && authenticateFlowPattern.test(callee.text)) report(node, "authenticate.flow call");
          },
          string(node) {
            const value = node.text.slice(1, -1);
            if (runtimePayloadKeys.has(value) && isKeyPosition(node)) report(node, `${value} payload key`);
          },
          property_identifier: payloadKey,
          shorthand_property_identifier: payloadKey,
          shorthand_property_identifier_pattern: payloadKey,
        };
      },
    },
  });
}

/** A string names a payload key only as a computed member (`body["action_run_id"]`) or an object key. */
function isKeyPosition(node: AgentlintNode): boolean {
  const parent = node.parent;
  const field =
    parent?.type === "subscript_expression"
      ? parent.childByFieldName("index")
      : parent?.type === "pair" || parent?.type === "pair_pattern"
        ? parent.childByFieldName("key")
        : null;
  return (
    field?.startPosition.row === node.startPosition.row && field.startPosition.column === node.startPosition.column
  );
}

export const flowActionHandlerReview = defineFlowActionHandlerReview();
