import { Kind } from "graphql";
import type { ESTree, Rule } from "@oxlint/plugins";
import { fieldHasHole, graphqlSource, mutationDocument } from "../graphql-support.js";
import { firstOption } from "../option-support.js";

/**
 * Mutations that fail at runtime without `@idempotent(key:)`. The schema does not mark the directive
 * as mandatory, so this table is the only static record. Re-review against the source when Shopify
 * publishes a new API version and bump `reviewed`.
 */
export const idempotencyRequirement = {
  source: "https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations",
  published: "2025-12-12",
  reviewed: "2026-09-20",
  since: "2026-04",
  mutations: [
    "refundCreate",
    "inventoryShipmentReceive",
    "inventoryAdjustQuantities",
    "inventoryMoveQuantities",
    "inventorySetQuantities",
    "inventorySetOnHandQuantities",
    "inventoryShipmentCreateInTransit",
    "inventoryShipmentCreate",
    "inventoryTransferCreate",
    "inventoryTransferCreateAsReadyToShip",
    "inventoryTransferDuplicate",
    "inventoryTransferSetItems",
    "inventorySetScheduledChanges",
    "inventoryActivate",
    "inventoryShipmentAddItems",
    "locationActivate",
    "locationDeactivate",
  ],
} as const;

const requiredMutations: ReadonlySet<string> = new Set(idempotencyRequirement.mutations);
const apiVersionPattern = /^20\d{2}-(?:01|04|07|10)$/;

function targetsRequirement(option: Record<string, unknown>): boolean {
  const since = option["since"];
  if (typeof since !== "string" || !apiVersionPattern.test(since)) return true;
  return since >= idempotencyRequirement.since;
}

/**
 * @attribution https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/usage/implementing-idempotency (inspiration; independently implemented)
 */
export const requireIdempotentMutations: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require @idempotent(key: $variable) on the 17 inventory, refund and location mutations that reject calls without it from Admin API 2026-04, and disallow literal keys. Option `since` names the API version the project pins.",
    },
    messages: {
      missingIdempotent: `Mutation \`{{mutation}}\` fails at runtime from Admin API ${idempotencyRequirement.since} without \`@idempotent(key: $key)\`, and older versions fall forward to it. Add the directive with a key variable that stays stable across retries.`,
      literalIdempotencyKey:
        "Mutation `{{mutation}}` hardcodes its idempotency key, so every later call within 24 hours is treated as a duplicate. Pass the key as a variable that is unique per logical operation and reused on retries.",
    },
    schema: [
      {
        type: "object",
        properties: { since: { type: "string", pattern: "^20\\d{2}-(?:01|04|07|10)$" } },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    const check = (node: ESTree.Node): void => {
      const source = graphqlSource(node);
      if (source === undefined) return;
      for (const field of mutationDocument(source.text).fields) {
        const mutation = field.name.value;
        if (!requiredMutations.has(mutation) || fieldHasHole(field, source.holes)) continue;
        const directive = field.directives?.find((candidate) => candidate.name.value === "idempotent");
        if (directive === undefined) {
          if (targetsRequirement(firstOption(context)))
            context.report({ node, messageId: "missingIdempotent", data: { mutation } });
          continue;
        }
        const key = directive.arguments?.find((argument) => argument.name.value === "key");
        if (key?.value.kind === Kind.STRING)
          context.report({ node, messageId: "literalIdempotencyKey", data: { mutation } });
      }
    };
    return { TemplateLiteral: check, Literal: check };
  },
};
