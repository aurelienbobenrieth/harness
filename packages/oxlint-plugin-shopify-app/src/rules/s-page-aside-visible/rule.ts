import type { Rule } from "@oxlint/plugins";
import { attribute, directElements, elementName } from "../jsx-support.js";

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page#slots-slotdetail-aside (inspiration; independently implemented) */
export const sPageAsideVisible: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow s-page aside content when an explicit small or large inlineSize prevents it from rendering.",
    },
    messages: {
      hidden:
        "This page width hides its aside slot: use inlineSize=base or move the content into the main page (Polaris Page aside).",
    },
  },
  createOnce(context) {
    return {
      JSXElement(node) {
        if (elementName(node.openingElement) !== "s-page") return;
        const width = attribute(node.openingElement, "inlineSize");
        if (width.kind !== "known" || (width.value !== "small" && width.value !== "large")) return;
        for (const child of directElements(node)) {
          const name = elementName(child.openingElement);
          if (name === undefined || !/^[a-z]/.test(name)) continue;
          const slot = attribute(child.openingElement, "slot");
          if (slot.kind === "known" && slot.value === "aside")
            context.report({ node: child.openingElement, messageId: "hidden" });
        }
      },
    };
  },
};
