import { eslintCompatPlugin } from "@oxlint/plugins";
import { fkColumnIndexed } from "./rules/fk-column-indexed/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "drizzle",
  },
  rules: {
    "fk-column-indexed": fkColumnIndexed,
  },
});
