import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";
import { elementName, matchesPattern } from "../jsx-support.js";

const reviewChecks = {
  home: [
    "Show the home page after setup and after dismissing optional content; demonstrate working status and useful current activity or metrics.",
    "For theme integrations, verify displayed activation state comes from app.extensions() and refreshes after a merchant changes it.",
  ],
  onboarding: [
    "Walk from a fresh install to the first useful result; justify requested information, show progress, and allow completed or optional setup to disappear.",
    "Keep setup concise; explain any required external account, preserve Shopify credential sign-up where applicable, and never imply an unrelated app is required.",
  ],
  navigation: [
    "Exercise direct links, nested routes, back navigation, and the host app menu; selected parent state and destinations must stay consistent.",
    "Show the primary workflow and third-party connection settings inside Shopify; document the applicable exception for any required external workflow.",
  ],
  responsive: [
    "Capture representative narrow and wide layouts with real content, long translations, loading, and errors; verify every control remains reachable without whole-page horizontal scrolling.",
    "Check native visual hierarchy, contrast, keyboard interaction, focus, and content stability; static component selection does not establish accessibility or responsive behavior.",
  ],
  premium: [
    "Exercise each entitled and unentitled plan: identify the needed tier and align visible disabled state with actual behavior; hide Plus-only capabilities from non-Plus merchants.",
    "Demonstrate upgrade and downgrade without reinstalling or contacting support, including accepted and declined billing changes where the app charges merchants.",
  ],
  "visual-editor": [
    "Change representative visual settings and show the preview updating; on desktop, keep controls and preview visible together.",
    "Exercise dirty state, discard, save, navigation, long forms, and failed saves; use organized sections and preserve merchant work.",
  ],
  inputs: [
    "Explain expected units, formats, and constraints beside inputs. Verify server-side validation and distinguish instant-apply switches from forms that save as a group.",
    "For color selection, provide a precise keyboard-usable input and demonstrate that the current value and contextual preview stay synchronized.",
  ],
  collections: [
    "Choose tables, menus, or choice controls from the merchant task and real data volume. Exercise selection, search, filtering, and pagination where needed rather than treating suggested item counts as universal limits.",
    "Verify mobile table transformation retains understandable labels and that menus do not conceal the primary action, overflow their viewport, or imply unavailable nested menus.",
  ],
  content: [
    "Review visible headings, action names, and translated copy for useful context, consistent terms, scanability, and accurate claims; preserve necessary detail instead of enforcing a sentence quota.",
    "Match tone to the actual task and explain impact or recovery directly; avoid assumptions about the merchant's emotions and congratulations for routine actions.",
    "Demonstrate access to clamped text and essential instructions on touch and keyboard devices; a tooltip must not be the only way to obtain required information.",
  ],
  "copy-mechanics": [
    "Review grammar in every shipped locale. For en-US copy, check sentence case and proper names; account for intentional brand, quotation, and consent-text exceptions.",
    "Verify locale-appropriate numerals, dates, times, currencies, and units using actual rendered values, including Intl configuration where applicable; link text must communicate its destination or purpose.",
  ],
  checkout: [
    "Exercise the actual checkout target: omit app promotions, review requests, countdowns, duplicate standard checkout fields, and payment-information collection.",
    "Demonstrate explicit buyer opt-in with visible cost before an optional charge is added; verify product information and the merchant's controls match the storefront.",
    "For checkout chat components, demonstrate that real-time customer service is the app's core chat function; a chat-shaped promotional or upsell surface does not meet that requirement.",
  ],
  "admin-extension": [
    "Run the configured admin block or action in its host: deliver a complete useful task without app promotions, cross-promotion, or review requests.",
    "Exercise overlay entry from the relevant merchant action; do not launch a large modal from navigation or background activity.",
    "Measure rendered admin blocks against the recommended height below 600px; review action designs exceeding 1200px of content or two pagination steps for a more suitable full-page workflow.",
  ],
  sidekick: [
    "Compare Sidekick tool and intent declarations, the app listing, and actual tool behavior; demonstrate a useful capability within the app's declared purpose.",
    "Inspect generated content and outcomes for app promotion, advertisements, cross-selling, or review requests; Sidekick extensions must not carry them.",
  ],
} as const;

/** Review areas selected by a project that knows the purpose of its routes. */
export type AppUxReviewArea = keyof typeof reviewChecks;

export type AppUxReviewTarget = {
  /** Pattern over the slash-normalized source path. */
  readonly filenamePattern: RegExp;
  /** Applicable review areas; an empty list does not schedule a review. */
  readonly areas: readonly AppUxReviewArea[];
  /** Use file for extension entry points without page JSX. Defaults to page. */
  readonly trigger?: "page" | "file";
};

export type AppUxReviewOptions = {
  /** Explicit route-to-purpose mapping. Empty by default; this rule is opt-in. */
  readonly targets?: readonly AppUxReviewTarget[];
  /** Page component names. Defaults to s-page; configure project wrappers explicitly. */
  readonly elementNamePattern?: RegExp;
};

/**
 * Attaches UX evidence requests only to explicitly identified app routes.
 * @attribution https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/user-experience/app-home-page (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/user-experience/onboarding (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/navigation (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/layout (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/content/voice-and-tone (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/content/grammar-and-mechanics (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/design/app-structure (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip (inspiration; independently implemented)
 */
export function defineAppUxReview(options: AppUxReviewOptions = {}): StateRule {
  options = structuredClone(options);
  const targets = options.targets ?? [];
  const areas = [...new Set(targets.flatMap((target) => target.areas))];
  const elements = options.elementNamePattern ?? /^s-page$/;
  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/app-ux-review",
      revision: 1,
      title: "App Ux Review",
      summary: "Requests UX evidence for explicitly configured app routes and extension entry points.",
      guidance: {
        standard:
          "Review only the areas named in the finding for this configured route; attach observations from the working app and record unresolved states.",
        checks: [
          "Identify the app surface, relevant merchant state, source revision, browser, and viewport for each observation. Accepted source review alone does not establish Built for Shopify eligibility.",
          ...areas.flatMap((area) => reviewChecks[area].map((check) => `${area}: ${check}`)),
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/launch/built-for-shopify/requirements",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/design/user-experience/app-home-page",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/design/user-experience/onboarding" },
          { type: "url", href: "https://shopify.dev/docs/apps/design/navigation" },
          { type: "url", href: "https://shopify.dev/docs/apps/design/layout" },
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/design/content" },
          { type: "url", href: "https://shopify.dev/docs/apps/design/content/voice-and-tone" },
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/design/content/grammar-and-mechanics",
          },
          { type: "url", href: "https://shopify.dev/docs/apps/design/app-structure" },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip",
          },
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/app-ux-review",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts"],
      options: {
        targets:
          options.targets?.map((target) => ({
            filenamePattern: {
              source: target.filenamePattern.source,
              flags: target.filenamePattern.flags,
            },
            areas: [...target.areas],
            trigger: target.trigger ?? "page",
          })) ?? null,
        elementNamePattern: options.elementNamePattern
          ? { source: options.elementNamePattern.source, flags: options.elementNamePattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [],
        mustStaySilent: [{ file: "src/view.tsx", source: "const ui=<s-page/>;" }],
      },
      id: "shopify-app/app-ux-review",
      version: 1,
      scan: "file",
      createOnce(context) {
        const reported = new Set<"page" | "file">();
        const check = (node: AgentlintNode, trigger: "page" | "file"): void => {
          if (reported.has(trigger) || (trigger === "page" && !matchesPattern(elements, elementName(node) ?? "")))
            return;
          const filename = context.path.replaceAll("\\", "/");
          const applicable = [
            ...new Set(
              targets
                .filter(
                  (target) =>
                    (target.trigger ?? "page") === trigger && matchesPattern(target.filenamePattern, filename),
                )
                .flatMap((target) => target.areas),
            ),
          ];
          if (applicable.length === 0) return;
          reported.add(trigger);
          context.report({
            node,
            message: `Configured app route requires UX evidence for: ${applicable.join(", ")}.`,
          });
        };
        return {
          before: () => {
            reported.clear();
          },
          program: (node) => check(node, "file"),
          jsx_opening_element: (node) => check(node, "page"),
          jsx_self_closing_element: (node) => check(node, "page"),
        };
      },
    },
  });
}

export const appUxReview = defineAppUxReview();
