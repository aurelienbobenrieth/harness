import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { elementName, matchesPattern, textOwner } from "../jsx-support.js";

export type ActionLabelClarityOptions = {
  /** Action component names. Defaults to s-button and s-link. */
  readonly elementNamePattern?: RegExp;
  /** Complete labels needing context review. Defaults to a small English lexicon. */
  readonly ambiguousLabelPatterns?: readonly RegExp[];
};

/**
 * Reviews ambiguous action labels without imposing English grammar on translations.
 * @attribution https://shopify.dev/docs/apps/design/content (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal (inspiration; independently implemented)
 */
export function defineActionLabelClarity(options: ActionLabelClarityOptions = {}): StateRule {
  options = structuredClone(options);
  const elements = options.elementNamePattern ?? /^s-(?:button|link)$/;
  const labels = options.ambiguousLabelPatterns ?? [/^(?:ok(?:ay)?|yes|no|submit|click here)$/iu];
  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/action-label-clarity",
      revision: 1,
      title: "Action Label Clarity",
      summary: "Reviews configured ambiguous literal labels on Polaris actions in their merchant context.",
      guidance: {
        standard: "An action label should let merchants predict the result in its surrounding context.",
        checks: [
          "Read the rendered action and nearby explanation together. Prefer a precise verb and object when the result would otherwise be unclear.",
          "Use the same term for the same action across headings, controls, and translations; preserve labels whose existing context makes them unambiguous.",
          "Review dynamic translations separately; the trigger only recognizes configured literal labels and does not score grammar or reading level.",
        ],
        refs: [
          { type: "url", href: "https://shopify.dev/docs/apps/design/content" },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/action-label-clarity",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        elementNamePattern: options.elementNamePattern
          ? { source: options.elementNamePattern.source, flags: options.elementNamePattern.flags }
          : null,
        ambiguousLabelPatterns:
          options.ambiguousLabelPatterns?.map((pattern) => ({
            source: pattern.source,
            flags: pattern.flags,
          })) ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: "const ui=<s-button>Yes</s-button>;" }],
        mustStaySilent: [{ file: "src/view.tsx", source: "const ui=<s-button>Add to cart</s-button>;" }],
      },
      id: "shopify-app/action-label-clarity",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        const check = (node: AgentlintNode): void => {
          const owner = textOwner(node);
          if (!owner || !matchesPattern(elements, elementName(owner) ?? "")) return;
          const label = (node.type === "string" ? node.text.slice(1, -1) : node.text).trim();
          if (!labels.some((pattern) => matchesPattern(pattern, label))) return;
          context.report({
            node,
            message: "Action label needs surrounding context: verify that merchants can predict its result.",
          });
        };
        return { jsx_text: check, string: check };
      },
    },
  });
}

export const actionLabelClarity = defineActionLabelClarity();
