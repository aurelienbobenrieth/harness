import type { Rule } from "@oxlint/plugins";
import { attribute, directElements, elementName } from "../jsx-support.js";

/**
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page#slots (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal#slots (inspiration; independently implemented)
 */
export const sActionSlotContract: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Validate statically assigned Polaris page/modal action slot element types, variants, and single-primary cardinality.",
    },
    messages: {
      primary: "The primary-action slot accepts one s-button with variant=primary (Polaris Page/Modal slots).",
      secondary:
        "The secondary-actions slot accepts secondary or auto s-buttons; s-page also accepts s-button-group (Polaris Page/Modal slots).",
    },
  },
  createOnce(context) {
    return {
      JSXElement(node) {
        const parentName = elementName(node.openingElement);
        if (parentName !== "s-page" && parentName !== "s-modal") return;
        let primaries = 0;
        for (const child of directElements(node)) {
          const opening = child.openingElement;
          const name = elementName(opening);
          const slot = attribute(opening, "slot");
          if (slot.kind !== "known") continue;
          if (name === undefined || !/^[a-z]/.test(name)) continue;
          if (slot.value === "primary-action") {
            primaries += 1;
            if (primaries > 1) {
              context.report({ node: opening, messageId: "primary" });
              continue;
            }
          }
          const variant = attribute(opening, "variant");
          if (
            slot.value === "primary-action" &&
            (name !== "s-button" ||
              variant.kind === "missing" ||
              (variant.kind === "known" && variant.value !== "primary"))
          )
            context.report({ node: opening, messageId: "primary" });
          if (
            slot.value === "secondary-actions" &&
            !(parentName === "s-page" && name === "s-button-group") &&
            (name !== "s-button" ||
              (variant.kind === "known" && variant.value !== "secondary" && variant.value !== "auto"))
          )
            context.report({ node: opening, messageId: "secondary" });
        }
      },
    };
  },
};
