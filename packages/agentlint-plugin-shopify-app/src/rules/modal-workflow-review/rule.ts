import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { elementName, matchesPattern, serializedPattern } from "../jsx-support.js";

export type ModalWorkflowReviewOptions = {
  /** Overlay component names to review. Defaults to s-modal and s-app-window. */
  readonly elementNamePattern?: RegExp;
};

/**
 * Keeps modal interaction and task fit as an evidence-backed review.
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/user-experience/forms (inspiration; independently implemented)
 */
export function defineModalWorkflowReview(options: ModalWorkflowReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const pattern = options.elementNamePattern ?? /^s-(?:modal|app-window)$/;
  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/modal-workflow-review",
      revision: 1,
      title: "Modal Workflow Review",
      summary: "Reviews modal and app-window workflows for merchant initiation, task fit, and usable dismissal.",
      guidance: {
        standard:
          "An overlay needs a focused purpose and a deliberate merchant entry point; a large editing workflow needs enough room to work.",
        checks: [
          "Trace every opening path to the relevant merchant interaction; opening during load, a timer, or an unrelated task needs correction.",
          "Demonstrate that the workflow does not launch another modal and that its action labels explain the decision.",
          "Use an app page or appropriate app window for large forms; group longer forms into named sections and preserve unsaved work.",
          "Exercise keyboard entry, dismissal, focus return, mobile layout, and request failure; show recovery within the affected overlay rather than opening an error dialog.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/design/user-experience/forms" },
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/modal-workflow-review",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        elementNamePattern: serializedPattern(options.elementNamePattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: "const ui=<s-modal/>;" }],
        mustStaySilent: [{ file: "src/view.tsx", source: "const ui=<p>Cart</p>;" }],
      },
      id: "shopify-app/modal-workflow-review",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        const check = (node: AgentlintNode): void => {
          if (!matchesPattern(pattern, elementName(node) ?? "")) return;
          context.report({
            node,
            message: "Overlay defines a merchant workflow: verify its opening paths, task fit, and dismissal behavior.",
          });
        };
        return { jsx_opening_element: check, jsx_self_closing_element: check };
      },
    },
  });
}

export const modalWorkflowReview = defineModalWorkflowReview();
