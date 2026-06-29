import { eslintCompatPlugin } from "@oxlint/plugins";
import { noExportedAnonymousObjectReturn } from "./rules/no-exported-anonymous-object-return/rule.js";
import { noMultiPositionalParameters } from "./rules/no-multi-positional-parameters/rule.js";
import { noMutableExportedState } from "./rules/no-mutable-exported-state/rule.js";
import { noVitestInSource } from "./rules/no-vitest-in-source/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "core",
  },
  rules: {
    "no-exported-anonymous-object-return": noExportedAnonymousObjectReturn,
    "no-multi-positional-parameters": noMultiPositionalParameters,
    "no-mutable-exported-state": noMutableExportedState,
    "no-vitest-in-source": noVitestInSource,
  },
});
