import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { matchesPattern } from "../jsx-support.js";

export type ReviewSolicitationOptions = {
  /** Request phrases in supported app languages; these extend the defaults. */
  readonly additionalPatterns?: readonly RegExp[];
  /** Set false for an app using only project-specific translation patterns. */
  readonly useDefaultPatterns?: boolean;
};

/**
 * Treats neutral review requests as review candidates, not policy violations.
 * @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/user-experience/marketing (inspiration; independently implemented)
 */
export function defineReviewSolicitation(options: ReviewSolicitationOptions = {}): StateRule {
  options = structuredClone(options);
  const defaults = [
    /\b(?:leave|write|post|give)\s+(?:(?:us|a|an|your)\s+){0,2}(?:(?:5|five)[ -]star\s+)?review\b/iu,
    /\brate\s+(?:us|this app|our app|the app)\b/iu,
    /\b(?:laissez|laisser|donnez|donner)\s+(?:un|votre)\s+avis\b/iu,
    /\b(?:bewerten sie|bewerte)\s+(?:uns|die app)\b/iu,
  ];
  const patterns = [...(options.useDefaultPatterns === false ? [] : defaults), ...(options.additionalPatterns ?? [])];
  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/review-solicitation",
      revision: 1,
      title: "Review Solicitation",
      summary: "Reviews app-rating request phrases for neutral wording, incentives, placement, and merchant control.",
      guidance: {
        standard:
          "Review requests must remain voluntary and neutral, with no reward or feature access tied to a review.",
        checks: [
          "Trace the request and its eligibility logic; remove incentives, requested star ratings, and withholding features for a review.",
          "Verify that the request does not appear in admin, checkout, or Sidekick extensions, where promotions and review requests are prohibited.",
          "On App Home, demonstrate unobtrusive placement, dismissal, and persistence; do not interrupt an unrelated workflow with a timed request.",
          "Confirm the string reaches a merchant-facing surface. Internal review tooling and other non-promotional uses can be resolved with evidence.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/design/user-experience/marketing" },
        ],
      },
    },
    binding: {
      id: "shopify-app/review-solicitation",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        additionalPatterns:
          options.additionalPatterns?.map((pattern) => ({
            source: pattern.source,
            flags: pattern.flags,
          })) ?? null,
        useDefaultPatterns: options.useDefaultPatterns ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: "const ui=<s-paragraph>Leave a review</s-paragraph>;" }],
        mustStaySilent: [
          {
            file: "src/view.tsx",
            source: "const ui=<s-paragraph>Review product details</s-paragraph>;",
          },
        ],
      },
      id: "shopify-app/review-solicitation",
      version: 1,
      scan: "file",
      createOnce(context) {
        const check = (node: AgentlintNode): void => {
          if (!patterns.some((pattern) => matchesPattern(pattern, node.text))) return;
          context.report({
            node,
            message:
              "Copy requests an app review: verify neutral wording, voluntary participation, and permitted placement.",
          });
        };
        return { jsx_text: check, string: check };
      },
    },
  });
}

export const reviewSolicitation = defineReviewSolicitation();
