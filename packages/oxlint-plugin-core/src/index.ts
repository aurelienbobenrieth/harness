import { eslintCompatPlugin } from "@oxlint/plugins";
import { noMultiPositionalParameters } from "./rules/no-multi-positional-parameters/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "core",
  },
  rules: {
    "no-multi-positional-parameters": noMultiPositionalParameters,
  },
});
