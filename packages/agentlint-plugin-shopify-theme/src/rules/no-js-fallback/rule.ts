import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

export type NoJsFallbackOptions = {
  /** Prefix of enhancer custom elements. Default: oio- */
  readonly elementPrefix?: string;
  /** Files that render interactive primitives. */
  readonly filePattern?: RegExp;
};

const defaultFilePattern = /^(?:blocks|sections)\/[^/]+\.liquid$/;
const fallbackPattern = /<form\b|<noscript\b|<details\b|<a\s/;

export function defineNoJsFallback(options: NoJsFallbackOptions = {}): AgentlintRule {
  const elementPrefix = options.elementPrefix ?? "oio-";
  const filePattern = options.filePattern ?? defaultFilePattern;

  return defineRule({
    id: "shopify-theme/no-js-fallback",
    description: "Flags enhancer wrappers whose Liquid renders no visible no-JS interaction path.",
    guidance: {
      standard:
        "JavaScript is an enhancement. Every interactive block must render a meaningful state without it: native forms submit, links navigate, details/summary toggles, or a noscript branch explains the limitation. An enhancer wrapper with none of these strands no-JS, crawler, and failed-network visitors.",
      checks: [
        "Cart, product, and search interactions post through native <form> elements the enhancer upgrades.",
        "Purely decorative enhancers (carousels degrading to scroll, galleries) may be fine: confirm the light DOM is usable when scripting is off.",
        "If no native path is possible, a <noscript> branch communicates the requirement.",
      ],
    },
    createOnce(context) {
      return {
        before(filename) {
          if (!filePattern.test(filename.replaceAll("\\", "/"))) return false;
          return undefined;
        },
        HtmlElement(node) {
          if (!node.text.startsWith(`<${elementPrefix}`)) return;
          if (fallbackPattern.test(node.text)) return;
          context.report({
            node,
            message: `<${elementPrefix}…> wrapper renders no form, link, details, or noscript fallback: verify the no-JS experience.`,
          });
        },
      };
    },
  });
}

export const noJsFallback = defineNoJsFallback();
