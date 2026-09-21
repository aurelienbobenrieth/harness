import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { matchesPattern } from "../jsx-support.js";

const defaultGraphqlCalleePattern = /(?:^|\.)(?:admin\.graphql|client\.(?:request|query))$/;
const loopTypes = new Set(["for_statement", "for_in_statement", "while_statement", "do_statement"]);
const functionTypes = new Set([
  "arrow_function",
  "function_expression",
  "function_declaration",
  "generator_function",
  "generator_function_declaration",
  "method_definition",
]);
const iterationMethodPattern = /^(?:map|forEach|flatMap)$/;

export type AdminApiLoopReviewOptions = {
  /**
   * Pattern tested against the callee text of a call expression. Defaults to `admin.graphql`,
   * `client.request`, and `client.query`, optionally qualified (`context.admin.graphql`). Extend it
   * with project wrappers such as `/(?:^|\.)shopifyGraphql$/`.
   */
  readonly graphqlCalleePattern?: RegExp;
};

function sameNode(left: AgentlintNode | null, right: AgentlintNode): boolean {
  return (
    left !== null &&
    left.type === right.type &&
    left.startPosition.row === right.startPosition.row &&
    left.startPosition.column === right.startPosition.column &&
    left.endPosition.row === right.endPosition.row &&
    left.endPosition.column === right.endPosition.column
  );
}

function isIterationCallback(node: AgentlintNode): boolean {
  const call = node.parent?.type === "arguments" ? node.parent.parent : null;
  if (call?.type !== "call_expression") return false;
  const callee = call.childByFieldName("function");
  if (callee?.type !== "member_expression") return false;
  return iterationMethodPattern.test(callee.childByFieldName("property")?.text ?? "");
}

/**
 * Names the repeating construct around a node. Evaluated-once positions (a `for…of` iterable, a
 * `for` initializer) and calls inside unrelated nested functions do not count as repetition.
 */
function repeatingAncestor(node: AgentlintNode): "loop" | "iteration callback" | undefined {
  let child = node;
  for (let parent = child.parent; parent; child = parent, parent = parent.parent) {
    if (loopTypes.has(parent.type)) {
      const evaluatedOnce =
        sameNode(parent.childByFieldName("right"), child) || sameNode(parent.childByFieldName("initializer"), child);
      if (!evaluatedOnce) return "loop";
    }
    if (functionTypes.has(parent.type)) {
      if (isIterationCallback(parent)) return "iteration callback";
      return undefined;
    }
  }
  return undefined;
}

/**
 * @attribution https://shopify.dev/docs/api/usage/limits (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/usage/bulk-operations/queries (inspiration; independently implemented)
 */
export function defineAdminApiLoopReview(options: AdminApiLoopReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const graphqlCalleePattern = options.graphqlCalleePattern ?? defaultGraphqlCalleePattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/admin-api-loop-review",
      revision: 1,
      title: "Admin API Loop Review",
      summary:
        "Flags Admin GraphQL calls issued from loops or iteration callbacks for cost, batching, and throttle review.",
      guidance: {
        standard:
          "The Admin GraphQL API meters calculated query cost per shop: one query costs at most 1,000 points, array inputs hold at most 250 items, and cursor pagination stops at 25,000 objects. A call repeated per item or per page spends that shared budget, and the app libraries retry zero times unless `tries` is passed, so a THROTTLED response surfaces as a failed request. Pass when every check below holds or is documented as not applicable.",
        checks: [
          "Bound: the iteration count is provably small (a fixed list, or at most one page of at most 250 items). Otherwise the work is batched into one request through `nodes(ids:)`, aliased fields, a set/bulk-add mutation such as `productSet`, or `bulkOperationRunQuery`/`bulkOperationRunMutation`.",
          "Placement: pagination over a merchant-sized collection (products, orders, customers, inventory) runs in a background job or bulk operation, never inside a loader, action, or webhook handler that must answer within seconds.",
          "Concurrency: `Promise.all` over per-item calls is absent or explicitly capped; an unbounded burst drains the bucket for every other feature of the app.",
          "Throttling: THROTTLED and HTTP 429 responses are handled by the `tries` option, a backoff of about one second, or pacing from `extensions.cost.throttleStatus`. A mutation retried this way is idempotent, and a retry reuses the same idempotency key instead of generating a new one.",
          "Selection: each repeated operation selects only the fields that are consumed afterwards, and connection `first`/`last` arguments match what is processed.",
          "Bulk results: completion is observed through the `bulk_operations/finish` webhook instead of tight polling, and the JSONL result is streamed line by line instead of parsed whole.",
        ],
        refs: [
          { type: "url", href: "https://shopify.dev/docs/api/admin-graphql/latest" },
          { type: "url", href: "https://shopify.dev/docs/api/usage/limits" },
          { type: "url", href: "https://shopify.dev/docs/api/usage/bulk-operations/queries" },
          { type: "url", href: "https://shopify.dev/docs/api/usage/implementing-idempotency" },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/admin-api-loop-review",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts", "**/*.{test,spec}.{ts,tsx,js,jsx}", "**/__tests__/**"],
      options: {
        graphqlCalleePattern: options.graphqlCalleePattern
          ? {
              source: options.graphqlCalleePattern.source,
              flags: options.graphqlCalleePattern.flags,
            }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "app/routes/app.sync.ts",
            source: "for (const id of ids) { await admin.graphql(QUERY, { variables: { id } }); }",
          },
          {
            file: "app/routes/app.sync.ts",
            source: "await Promise.all(ids.map((id) => admin.graphql(QUERY, { variables: { id } })));",
          },
        ],
        mustStaySilent: [
          {
            file: "app/routes/app.sync.ts",
            source: "const response = await admin.graphql(QUERY);",
          },
          {
            file: "app/routes/app.sync.ts",
            source: "for (const edge of (await admin.graphql(QUERY)).edges) { total += edge.node.count; }",
          },
        ],
      },
      id: "shopify-app/admin-api-loop-review",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          call_expression(node) {
            const callee = node.childByFieldName("function");
            if (!callee || !matchesPattern(graphqlCalleePattern, callee.text)) return;
            const construct = repeatingAncestor(node);
            if (!construct) return;
            context.report({
              node,
              message: `Admin API call ${callee.text}() runs inside a ${construct}: batch it into one request or a bulk operation, or record why the iteration is bounded and how THROTTLED responses are handled.`,
            });
          },
        };
      },
    },
  });
}

export const adminApiLoopReview = defineAdminApiLoopReview();
