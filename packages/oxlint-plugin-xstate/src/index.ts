import { eslintCompatPlugin } from "@oxlint/plugins";
import { machineNaming } from "./rules/machine-naming/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "xstate",
  },
  rules: {
    "machine-naming": machineNaming,
  },
});
