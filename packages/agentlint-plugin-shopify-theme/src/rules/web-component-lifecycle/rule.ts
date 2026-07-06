import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

const defaultDefineCallPattern = /^customElements\.define\s*\(/;
const defaultDefineDecoratorPattern = /^@customElement\s*\(/;

export type WebComponentLifecycleOptions = {
  /** Pattern matching imperative custom element registrations. */
  readonly defineCallPattern?: RegExp;
  /** Pattern matching decorator-based registrations (Lit's @customElement). */
  readonly defineDecoratorPattern?: RegExp;
};

export function defineWebComponentLifecycle(options: WebComponentLifecycleOptions = {}): AgentlintRule {
  const defineCallPattern = options.defineCallPattern ?? defaultDefineCallPattern;
  const defineDecoratorPattern = options.defineDecoratorPattern ?? defaultDefineDecoratorPattern;
  const message =
    "Custom element registration: verify listeners, observers, and requests are cleaned up on disconnect.";

  return defineRule({
    id: "shopify-theme/web-component-lifecycle",
    description: "Flags custom element registrations that need lifecycle-cleanup review.",
    guidance: {
      standard:
        "Theme web components must clean up everything they attach: listeners, observers, timers, and in-flight requests end in disconnectedCallback, because sections re-render in the theme editor and on cart updates.",
      checks: [
        "Document/window listeners added in connectedCallback are removed (or bound with an AbortController that is aborted) in disconnectedCallback.",
        "In-flight fetches are aborted on disconnect so late responses cannot touch detached DOM.",
        "Intervals, timeouts, and observers are cancelled on disconnect.",
      ],
      refs: [{ type: "url", href: "https://shopify.dev/docs/storefronts/themes/best-practices/performance" }],
    },
    createOnce(context) {
      return {
        call_expression(node) {
          if (!defineCallPattern.test(node.text)) return;
          context.report({ node, message });
        },
        decorator(node) {
          if (!defineDecoratorPattern.test(node.text)) return;
          context.report({ node, message });
        },
      };
    },
  });
}

export const webComponentLifecycle = defineWebComponentLifecycle();
