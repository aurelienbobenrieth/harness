import { defineRule, type StateRule, type AgentlintNode } from "@aurelienbbn/agentlint";
import { attributeValue, matchesPattern } from "../jsx-support.js";

const defaultFormElementPattern = /^<(?:form|Form)(?=[\s/>])/;

export type SettingsSaveBarOptions = {
  /** Pattern matching form-like JSX opening elements. Defaults to form and Form. */
  readonly formElementPattern?: RegExp;
  /**
   * Pattern identifying trusted save-bar wiring on this form opening element. By default,
   * only a direct data-save-bar attribute is recognized; point this at your project's abstraction if it
   * goes by another name.
   */
  readonly saveBarMarkerPattern?: RegExp;
};

/**
 * @attribution https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api (inspiration; independently implemented)
 */
export function defineSettingsSaveBar(options: SettingsSaveBarOptions = {}): StateRule {
  options = structuredClone(options);
  const formElementPattern = options.formElementPattern ?? defaultFormElementPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "shopify-app/settings-save-bar",
      revision: 1,
      title: "Settings Save Bar",
      summary: "Flags forms in embedded app pages that lack a contextual save bar integration.",
      guidance: {
        standard:
          "Settings and form pages in embedded apps must integrate the App Bridge contextual save bar so unsaved changes prompt Save or Discard before navigation (BFS 4.1.5).",
        checks: [
          "Dirty form state shows the contextual save bar, not a page-local save button alone.",
          "Navigating away with unsaved changes is guarded by the save bar Save/Discard interaction.",
          "Read-only forms, search forms, and filters do not need a save bar.",
        ],
        refs: [
          {
            type: "url",
            href: "https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api",
          },
        ],
      },
    },
    binding: {
      id: "shopify-app/settings-save-bar",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}", "**/locales/**/*.json"],
      exclude: ["**/*.d.ts"],
      options: {
        formElementPattern: options.formElementPattern
          ? { source: options.formElementPattern.source, flags: options.formElementPattern.flags }
          : null,
        saveBarMarkerPattern: options.saveBarMarkerPattern
          ? {
              source: options.saveBarMarkerPattern.source,
              flags: options.saveBarMarkerPattern.flags,
            }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/view.tsx", source: "const ui=<form/>;" }],
        mustStaySilent: [{ file: "src/view.tsx", source: "const ui=<form data-save-bar/>;" }],
      },
      id: "shopify-app/settings-save-bar",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        const check = (node: AgentlintNode): void => {
          if (!matchesPattern(formElementPattern, node.text)) return;
          const marker = attributeValue(node, "data-save-bar");
          if (
            options.saveBarMarkerPattern
              ? matchesPattern(options.saveBarMarkerPattern, node.text)
              : marker === true || typeof marker === "string"
          )
            return;
          context.report({
            node,
            message: "Form without its own save-bar marker: confirm the contextual save bar covers it.",
          });
        };
        return { jsx_opening_element: check, jsx_self_closing_element: check };
      },
    },
  });
}

export const settingsSaveBar = defineSettingsSaveBar();
