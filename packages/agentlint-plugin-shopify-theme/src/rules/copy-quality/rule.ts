import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

export type CopyQualityOptions = {
  /** Additional phrases that signal weak interaction copy. */
  readonly weakPhrases?: readonly string[];
};

const defaultWeakPhrases = ["click here", "tap here", "learn more", "read more here"];
const shoutingPattern = /^[A-Z][A-Z\s!?.,'-]{5,}$/u;

export function defineCopyQuality(options: CopyQualityOptions = {}): AgentlintRule {
  const weakPhrases = options.weakPhrases ?? defaultWeakPhrases;

  return defineRule({
    id: "shopify-theme/copy-quality",
    description: "Reviews hardcoded storefront copy for shouting case and weak link phrasing.",
    guidance: {
      standard:
        "Merchant-facing copy uses sentence case; emphasis belongs to CSS (text-transform), not the string, so translations and screen readers stay clean. Link and button copy names the destination or action, never 'click here'.",
      checks: [
        "ALL-CAPS strings become sentence case with text-transform: uppercase where the design wants caps.",
        "Links/buttons describe their action ('Add to cart', 'View collection'), not the gesture.",
        "Copy assembled by concatenating translated fragments breaks grammar in other locales: use interpolation placeholders.",
      ],
    },
    createOnce(context) {
      return {
        TextNode(node) {
          const text = node.text.trim();
          if (text.length === 0 || text.includes("{{") || text.includes("{%")) return;
          const lower = text.toLowerCase();
          const weak = weakPhrases.find((phrase) => lower.includes(phrase));
          if (weak !== undefined) {
            context.report({ node, message: `"${text.slice(0, 60)}": name the action instead of "${weak}".` });
            return;
          }
          if (shoutingPattern.test(text)) {
            context.report({
              node,
              message: `"${text.slice(0, 60)}": use sentence case and let CSS text-transform handle emphasis.`,
            });
          }
        },
      };
    },
  });
}

export const copyQuality = defineCopyQuality();
