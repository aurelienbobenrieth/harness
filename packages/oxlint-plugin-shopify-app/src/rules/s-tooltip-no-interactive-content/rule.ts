import type { ESTree, Rule } from "@oxlint/plugins";
import { attribute, directElements, elementName } from "../jsx-support.js";

const interactiveElements = new Set([
  "button",
  "select",
  "textarea",
  "summary",
  "s-button",
  "s-link",
  "s-clickable",
  "s-clickable-chip",
  "s-text-field",
  "s-email-field",
  "s-url-field",
  "s-password-field",
  "s-search-field",
  "s-number-field",
  "s-money-field",
  "s-text-area",
  "s-select",
  "s-checkbox",
  "s-switch",
  "s-choice-list",
  "s-date-field",
  "s-color-field",
  "s-drop-zone",
  "s-color-picker",
  "s-date-picker",
]);

function isInteractive(node: ESTree.JSXOpeningElement, name: string): boolean {
  if (interactiveElements.has(name)) return true;
  if (name === "input") {
    const type = attribute(node, "type");
    return type.kind === "missing" || (type.kind === "known" && type.value !== "hidden");
  }
  if (name === "a") {
    const href = attribute(node, "href");
    return href.kind === "known" && typeof href.value === "string";
  }
  const tabIndex = attribute(node, "tabIndex");
  return (
    tabIndex.kind === "known" &&
    (typeof tabIndex.value === "number" || typeof tabIndex.value === "string") &&
    Number.isFinite(Number(tabIndex.value)) &&
    Number(tabIndex.value) >= 0
  );
}

function interactiveDescendants(element: ESTree.JSXElement): readonly ESTree.JSXOpeningElement[] {
  return directElements(element).flatMap((child) => {
    const name = elementName(child.openingElement);
    if (name === undefined || !/^[a-z]/.test(name)) return [];
    return isInteractive(child.openingElement, name) ? [child.openingElement] : interactiveDescendants(child);
  });
}

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip (inspiration; independently implemented) */
export const sTooltipNoInteractiveContent: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow statically interactive intrinsic descendants inside Polaris tooltips; custom component and conditional output require review.",
    },
    messages: {
      interactive:
        "This tooltip contains interactive content that users cannot operate reliably: move the control into visible content or a popover (Polaris Tooltip limitations).",
    },
  },
  createOnce(context) {
    return {
      JSXElement(node) {
        if (elementName(node.openingElement) !== "s-tooltip") return;
        for (const opening of interactiveDescendants(node)) context.report({ node: opening, messageId: "interactive" });
      },
    };
  },
};
