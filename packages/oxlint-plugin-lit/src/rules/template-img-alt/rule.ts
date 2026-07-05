import type { Rule } from "@oxlint/plugins";
import { hasBoundOrStaticAttribute, imageTags, litTemplateText } from "../template-support.js";

const message =
  "Images in Lit templates need an alt attribute: descriptive for content images, empty for decorative ones.";

export const templateImgAlt: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require alt attributes on img elements inside Lit html templates.",
    },
    messages: {
      templateImgAlt: message,
    },
  },
  createOnce(context) {
    return {
      TaggedTemplateExpression(node) {
        const templateText = litTemplateText(node);
        if (templateText === undefined) return;

        for (const imageTag of imageTags(templateText)) {
          if (hasBoundOrStaticAttribute(imageTag, "alt")) continue;
          context.report({ node, messageId: "templateImgAlt" });
          return;
        }
      },
    };
  },
};
