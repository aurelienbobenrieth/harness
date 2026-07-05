import { eslintCompatPlugin } from "@oxlint/plugins";
import { noShadowDom } from "./rules/no-shadow-dom/rule.js";
import { templateImgAlt } from "./rules/template-img-alt/rule.js";
import { templateNoAutofocus } from "./rules/template-no-autofocus/rule.js";
import { templateNoPositiveTabindex } from "./rules/template-no-positive-tabindex/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "lit",
  },
  rules: {
    "no-shadow-dom": noShadowDom,
    "template-img-alt": templateImgAlt,
    "template-no-autofocus": templateNoAutofocus,
    "template-no-positive-tabindex": templateNoPositiveTabindex,
  },
});
