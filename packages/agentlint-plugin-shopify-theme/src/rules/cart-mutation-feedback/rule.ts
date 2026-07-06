import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

// No leading slash requirement: carts are also reached through
// `Shopify.routes.root + 'cart/add.js'` and locale-prefixed URLs.
const defaultEndpointPattern = /\bcart\/(?:add|change|update|clear)(?:\.js)?\b/;
const defaultNetworkCallPattern = /^(?:await\s+)?(?:(?:window|globalThis|self)\.)?fetch\s*\(/;

export type CartMutationFeedbackOptions = {
  /** Pattern matching cart mutation endpoints inside the call text. */
  readonly endpointPattern?: RegExp;
  /** Pattern matching network call expressions; extend for project fetch wrappers. */
  readonly networkCallPattern?: RegExp;
};

export function defineCartMutationFeedback(options: CartMutationFeedbackOptions = {}): AgentlintRule {
  const endpointPattern = options.endpointPattern ?? defaultEndpointPattern;
  const networkCallPattern = options.networkCallPattern ?? defaultNetworkCallPattern;

  return defineRule({
    id: "shopify-theme/cart-mutation-feedback",
    description: "Flags AJAX cart mutations that need buyer-feedback coverage.",
    guidance: {
      standard:
        "Cart mutations must give buyers immediate, accessible feedback: pending state on the control, error recovery on failure, an aria-live announcement, and a cart-updated event so other components stay in sync.",
      checks: [
        "The triggering control shows a pending state and failed requests restore it with a visible, non-toast-only error.",
        "Optimistic updates revert on failure.",
        "Screen readers hear the result through an aria-live region.",
        "A bubbling custom event (for example cart:updated) notifies cart drawer and counter components.",
      ],
      refs: [{ type: "url", href: "https://shopify.dev/docs/api/ajax/reference/cart" }],
    },
    createOnce(context) {
      return {
        call_expression(node) {
          if (!networkCallPattern.test(node.text)) return;
          if (!endpointPattern.test(node.text)) return;
          context.report({
            node,
            message:
              "AJAX cart mutation: verify pending state, error recovery, aria-live announcement, and cart event.",
          });
        },
      };
    },
  });
}

export const cartMutationFeedback = defineCartMutationFeedback();
