import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { attributeValue, elementName, matchesPattern } from "../jsx-support.js";

export type DestructiveActionReviewOptions = {
  /** Action component names. Defaults to s-button and s-clickable. */
  readonly elementNamePattern?: RegExp;
  /** Prop carrying the destructive tone. Defaults to tone. */
  readonly toneAttribute?: string;
  /** Literal tone indicating a destructive operation. Defaults to critical. */
  readonly destructiveTone?: string;
};

/**
 * Reviews declared destructive intent, including appropriately reversible alternatives.
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/actions/button (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal (inspiration; independently implemented)
 */
export function defineDestructiveActionReview(options: DestructiveActionReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const pattern = options.elementNamePattern ?? /^s-(?:button|clickable)$/;
  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/destructive-action-review",
      revision: 1,
      title: "Destructive Action Review",
      summary:
        "Reviews actions explicitly marked with a destructive tone for consequences, confirmation, and failure handling.",
      guidance: {
        standard:
          "Destructive styling must correspond to destructive impact, with a safe and understandable merchant decision.",
        checks: [
          "Identify what changes, its scope, and whether undo is possible. Do not use critical tone to promote or emphasize an ordinary action.",
          "For consequential irreversible actions, demonstrate confirmation explaining the affected resource and consequences, with a clear way to cancel.",
          "Use a specific action label and make the next logical action visually clear; a routine reversible action can use a proportionate undo flow.",
          "Exercise repeat activation, request failure, cancellation, and success. Prevent duplicate work and retain context when recovery is needed.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/actions/button",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/destructive-action-review",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        elementNamePattern: options.elementNamePattern
          ? { source: options.elementNamePattern.source, flags: options.elementNamePattern.flags }
          : null,
        toneAttribute: options.toneAttribute ?? null,
        destructiveTone: options.destructiveTone ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: 'const ui=<s-button tone="critical">Delete</s-button>;' }],
        mustStaySilent: [{ file: "src/view.tsx", source: "const ui=<s-button>Add</s-button>;" }],
      },
      id: "shopify-app/destructive-action-review",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        const check = (node: AgentlintNode): void => {
          if (!matchesPattern(pattern, elementName(node) ?? "")) return;
          if (attributeValue(node, options.toneAttribute ?? "tone") !== (options.destructiveTone ?? "critical")) return;
          context.report({
            node,
            message:
              "Action declares destructive intent: verify consequences, a safe decision path, and retry behavior.",
          });
        };
        return { jsx_opening_element: check, jsx_self_closing_element: check };
      },
    },
  });
}

export const destructiveActionReview = defineDestructiveActionReview();
