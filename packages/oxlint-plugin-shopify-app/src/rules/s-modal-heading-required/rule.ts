import type { Rule } from "@oxlint/plugins";
import { firstOption, stringArrayOption } from "../option-support.js";
import { attribute, elementName, potentiallyNonemptyString } from "../jsx-support.js";

const message = "Modals must announce their purpose: set the `heading` attribute on the modal element (BFS 4.1.6).";

const defaultModalComponents = ["s-modal"] as const;

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal (inspiration; independently implemented) */
export const sModalHeadingRequired: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a heading attribute on modal elements. Option `components` overrides the checked element names.",
    },
    messages: {
      sModalHeadingRequired: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          components: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        const components = stringArrayOption(firstOption(context), "components", defaultModalComponents);
        if (!components.includes(elementName(node) ?? "")) return;
        if (potentiallyNonemptyString(attribute(node, "heading"))) return;
        context.report({ node, messageId: "sModalHeadingRequired" });
      },
    };
  },
};
