import { eslintCompatPlugin } from "@oxlint/plugins";
import { noRawJsonParse } from "./rules/no-raw-json-parse/rule.js";
import { noRawJsonStringify } from "./rules/no-raw-json-stringify/rule.js";
import { noUnsafeErrorChannel } from "./rules/no-unsafe-error-channel/rule.js";
import { noUnsafeEffectBody } from "./rules/no-unsafe-effect-body/rule.js";
import { requireForEachConcurrency } from "./rules/require-for-each-concurrency/rule.js";
import { requireTaggedEffectFail } from "./rules/require-tagged-effect-fail/rule.js";
import { useRootImports } from "./rules/use-root-imports/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "effect",
  },
  rules: {
    "no-raw-json-parse": noRawJsonParse,
    "no-raw-json-stringify": noRawJsonStringify,
    "no-unsafe-error-channel": noUnsafeErrorChannel,
    "no-unsafe-effect-body": noUnsafeEffectBody,
    "require-for-each-concurrency": requireForEachConcurrency,
    "require-tagged-effect-fail": requireTaggedEffectFail,
    "use-root-imports": useRootImports,
  },
});
