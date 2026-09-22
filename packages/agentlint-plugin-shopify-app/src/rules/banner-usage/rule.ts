import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { elementName, matchesPattern, serializedPattern } from "../jsx-support.js";

export type BannerUsageOptions = {
  /** Exact component names to review. Defaults to the App Home s-banner component. */
  readonly elementNamePattern?: RegExp;
};

/**
 * Reviews banner intent and persistence, which a dismissible prop cannot establish.
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/user-experience/marketing (inspiration; independently implemented)
 */
export function defineBannerUsage(options: BannerUsageOptions = {}): StateRule {
  options = structuredClone(options);
  const pattern = options.elementNamePattern ?? /^s-banner$/;
  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/banner-usage",
      revision: 1,
      title: "Banner Usage",
      summary: "Reviews App Home banners for purpose, context, dismissal persistence, and competing messages.",
      guidance: {
        standard:
          "A banner needs a relevant purpose, proportionate tone, and a clear next step; its props alone do not prove those qualities.",
        checks: [
          "Review the rendered message, surrounding content, and destination of each action; keep one main purpose per banner.",
          "Choose placement and tone from the affected task; reserve critical treatment for a problem requiring immediate action.",
          "Show a dismissal test across navigation and reload. The component does not persist dismissal itself.",
          "For promotional content, verify the same merchant does not see it again after dismissal; do not place promotions beside the workflow's primary action.",
          "Exercise conditions that could show multiple banners together and demonstrate prioritization rather than simultaneous competing messages.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/design/user-experience/marketing" },
        ],
      },
    },
    binding: {
      id: "shopify-app/banner-usage",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        elementNamePattern: serializedPattern(options.elementNamePattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: 'const ui=<s-banner heading="Saved"/>;' }],
        mustStaySilent: [{ file: "src/view.tsx", source: "const ui=<p>Saved</p>;" }],
      },
      id: "shopify-app/banner-usage",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        const check = (node: AgentlintNode): void => {
          if (!matchesPattern(pattern, elementName(node) ?? "")) return;
          context.report({
            node,
            message:
              "Banner renders a merchant message: verify its purpose and dismissal behavior with the surrounding UI.",
          });
        };
        return { jsx_opening_element: check, jsx_self_closing_element: check };
      },
    },
  });
}

export const bannerUsage = defineBannerUsage();
