import { defineRule, type StateRule } from "@aurelienbbn/agentlint";

/**
 * Built-in pressure/guarantee lexicons per language. Copy rules must never
 * assume English-only UI: merchant-facing themes and apps ship localized
 * strings, so the trigger scans every configured language.
 */
const pressureLexicons = {
  en: /hurry|last chance|act now|don'?t miss|limited[- ]time|only \d+ (?:left|remaining)|offer ends|expires? (?:soon|in )|guarantee[ds]? (?:sales|revenue|results|growth|conversions)/iu,
  fr: /d[ée]p[êe]chez[- ]vous|derni[èe]re chance|offre limit[ée]e|dur[ée]e limit[ée]e|plus que \d+|n'attendez plus|l'offre (?:se termine|expire)|expire bient[ôo]t|(?:ventes|revenus|r[ée]sultats|croissance) garantis?/iu,
  de: /beeil(?:en sie sich| dich)|letzte chance|nur noch \d+|nur f[üu]r kurze zeit|zeitlich begrenzt|angebot endet|l[äa]uft bald ab|garantierte[rs]? (?:umsatz|umsätze|verk[äa]ufe|ergebnisse|wachstum)|nicht verpassen|jetzt (?:zugreifen|handeln)/iu,
} as const;

export type PressureCopyLanguage = keyof typeof pressureLexicons;

export type NoPressureCopyOptions = {
  /** Languages whose built-in lexicons are active. Defaults to en, fr, de. */
  readonly languages?: readonly PressureCopyLanguage[];
  /** Project-specific patterns matched in addition to the built-in lexicons. */
  readonly additionalPatterns?: readonly RegExp[];
};

/**
 * @attribution https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently implemented)
 */
export function defineNoPressureCopy(options: NoPressureCopyOptions = {}): StateRule {
  options = structuredClone(options);
  const languages = options.languages ?? ["en", "fr", "de"];
  const patterns = [...languages.map((language) => pressureLexicons[language]), ...(options.additionalPatterns ?? [])];

  const reportsOnCopy = (text: string): boolean =>
    patterns.some((pattern) => {
      return pattern.test(text);
    });

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/no-pressure-copy",
      revision: 1,
      title: "No Pressure Copy",
      summary: "Flags urgency, scarcity, or outcome-guarantee copy in merchant-facing UI.",
      guidance: {
        standard:
          "Merchant-facing copy must not use pressure tactics (countdowns, urgency, guilt) or guarantee outcomes, in any language the app ships. Both are Built for Shopify rejections (BFS 4.3.1, 4.3.2).",
        checks: [
          "Urgency copy is acceptable only for real, externally imposed deadlines such as a carrier cutoff, and states the factual deadline.",
          "No copy promises or guarantees revenue, sales, or growth outcomes.",
          "Countdown timers do not appear near trial, billing, upgrade, or campaign prompts.",
          "Translated copy in locale files and translation helpers meets the same bar as the source language.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/apps/launch/built-for-shopify/requirements",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/no-pressure-copy",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        languages: options.languages ?? null,
        additionalPatterns:
          options.additionalPatterns?.map((pattern) => ({
            source: pattern.source,
            flags: pattern.flags,
          })) ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: 'const copy="Hurry!";' }],
        mustStaySilent: [{ file: "src/view.tsx", source: 'const copy="Cart";' }],
      },
      id: "shopify-app/no-pressure-copy",
      version: 1,
      scan: "file",
      createOnce(context) {
        return {
          jsx_text(node) {
            if (!reportsOnCopy(node.text)) return;
            context.report({
              node,
              message: "Copy reads as pressure or outcome-guarantee wording: verify intent.",
            });
          },
          string(node) {
            if (!reportsOnCopy(node.text)) return;
            context.report({
              node,
              message: "String reads as pressure or outcome-guarantee wording: verify intent.",
            });
          },
        };
      },
    },
  });
}

export const noPressureCopy = defineNoPressureCopy();
