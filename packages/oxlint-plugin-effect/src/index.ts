import { eslintCompatPlugin } from "@oxlint/plugins";
import { noRawJsonParse } from "./rules/no-raw-json-parse.js";

export default eslintCompatPlugin({
  meta: {
    name: "effect",
  },
  rules: {
    "no-raw-json-parse": noRawJsonParse,
  },
});
