import { eslintCompatPlugin } from "@oxlint/plugins";
import { noRawJsonParse } from "./rules/no-raw-json-parse.js";
import { noRawJsonStringify } from "./rules/no-raw-json-stringify.js";

export default eslintCompatPlugin({
  meta: {
    name: "effect",
  },
  rules: {
    "no-raw-json-parse": noRawJsonParse,
    "no-raw-json-stringify": noRawJsonStringify,
  },
});
