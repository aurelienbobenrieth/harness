import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

export type ApgPatternOptions = {
  /** ARIA roles whose usage triggers an APG review. */
  readonly roles?: readonly string[];
};

const defaultRoles = [
  "dialog",
  "alertdialog",
  "menu",
  "menubar",
  "tablist",
  "listbox",
  "combobox",
  "slider",
  "tree",
  "grid",
];

export function defineApgPattern(options: ApgPatternOptions = {}): AgentlintRule {
  const roles = options.roles ?? defaultRoles;
  const rolePattern = new RegExp(`role=["'](?<role>${roles.join("|")})["']`, "u");

  return defineRule({
    id: "shopify-theme/apg-pattern",
    description: "Flags composite ARIA roles for review against the corresponding WAI-ARIA APG pattern.",
    guidance: {
      standard:
        "A composite role is a keyboard contract. Rendering role=dialog, menu, tablist, listbox, combobox, slider, tree, or grid commits the theme to that pattern's full APG behavior: focus management, arrow-key navigation, ESC handling, and required aria-* states.",
      checks: [
        "Dialogs trap focus, restore it on close, and close on ESC (see keyboard e2e suite).",
        "Menus/tablists/listboxes implement arrow-key navigation and aria-selected/aria-expanded states.",
        "If the full pattern is not implemented, prefer native elements (details, select, dialog) or drop the role.",
      ],
      refs: [{ type: "url", href: "https://www.w3.org/WAI/ARIA/apg/patterns/" }],
    },
    createOnce(context) {
      return {
        HtmlElement(node) {
          const openingTag = node.text.slice(0, node.text.indexOf(">") + 1);
          const match = rolePattern.exec(openingTag);
          if (match?.groups?.["role"] === undefined) return;
          context.report({
            node,
            message: `role="${match.groups["role"]}" commits to the APG ${match.groups["role"]} pattern: verify keyboard and aria-* behavior.`,
          });
        },
      };
    },
  });
}

export const apgPattern = defineApgPattern();
