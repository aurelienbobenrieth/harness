import { eslintCompatPlugin } from "@oxlint/plugins";
import { noExportedAnonymousObjectReturn } from "./rules/no-exported-anonymous-object-return/rule.js";
import { noMultiPositionalParameters } from "./rules/no-multi-positional-parameters/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "core",
  },
  rules: {
    "no-exported-anonymous-object-return": noExportedAnonymousObjectReturn,
    "no-multi-positional-parameters": noMultiPositionalParameters,
  },
});
