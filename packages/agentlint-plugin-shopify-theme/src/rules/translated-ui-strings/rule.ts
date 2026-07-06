import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

const defaultTextProperties = ["textContent", "innerText", "innerHTML"] as const;

export type TranslatedUiStringsOptions = {
  /** DOM properties treated as user-facing text sinks. */
  readonly textProperties?: readonly string[];
  /** Minimum count of letters (any script) before a literal counts as copy. */
  readonly minLetters?: number;
};

export function defineTranslatedUiStrings(options: TranslatedUiStringsOptions = {}): AgentlintRule {
  const textProperties = options.textProperties ?? defaultTextProperties;
  const minLetters = options.minLetters ?? 3;
  // \p{L} keeps the trigger language-agnostic: accented French, German
  // umlauts, and non-Latin scripts all count as copy.
  const textAssignmentPattern = new RegExp(
    `\\.(?:${textProperties.join("|")})\\s*=\\s*(?:'|"|\`)(?:[^'"\`]*\\p{L}){${minLetters}}`,
    "u",
  );

  return defineRule({
    id: "shopify-theme/translated-ui-strings",
    description: "Flags hardcoded user-facing strings assigned from theme JavaScript.",
    guidance: {
      standard:
        "Every buyer-facing string must come from the theme's locale files. JavaScript should read translated strings from data attributes, embedded JSON, or server-rendered templates, not string literals.",
      checks: [
        "Buyer-visible text assigned from JS originates in locales/*.json (rendered into data attributes or JSON script tags with the t filter).",
        "Developer-only strings such as console messages and internal states are fine as literals.",
        "Dynamic messages interpolate translated templates instead of concatenating language fragments.",
      ],
      refs: [{ type: "url", href: "https://shopify.dev/docs/storefronts/themes/architecture/locales" }],
    },
    createOnce(context) {
      return {
        assignment_expression(node) {
          if (!textAssignmentPattern.test(node.text)) return;
          context.report({
            node,
            message: "DOM text assigned from a string literal: verify buyer-facing copy comes from locale files.",
          });
        },
      };
    },
  });
}

export const translatedUiStrings = defineTranslatedUiStrings();
