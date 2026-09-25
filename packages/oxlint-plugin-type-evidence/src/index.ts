import { eslintCompatPlugin } from "@oxlint/plugins";
import { noChainedTypeAssertions } from "./rules/no-chained-type-assertions/rule.js";
import { noKnownValueWidening } from "./rules/no-known-value-widening/rule.js";
import { noObjectParameters } from "./rules/no-object-parameters/rule.js";
import { noRuntimeTypeof } from "./rules/no-runtime-typeof/rule.js";
import { noUnknownParameters } from "./rules/no-unknown-parameters/rule.js";
import { noUnknownReturns } from "./rules/no-unknown-returns/rule.js";
import { noUnknownTypeAliases } from "./rules/no-unknown-type-aliases/rule.js";
import { noUnsafeDictionaryType } from "./rules/no-unsafe-dictionary-type/rule.js";
import { noWidenThenAssert } from "./rules/no-widen-then-assert/rule.js";
import { requireSafetyCommentForTypeAssertion } from "./rules/require-safety-comment-for-type-assertion/rule.js";

export const strictRules: Readonly<Record<string, "error">> = {
  "type-evidence/no-chained-type-assertions": "error",
  "type-evidence/no-known-value-widening": "error",
  "type-evidence/no-object-parameters": "error",
  "type-evidence/no-runtime-typeof": "error",
  "type-evidence/no-unknown-parameters": "error",
  "type-evidence/no-unknown-returns": "error",
  "type-evidence/no-unknown-type-aliases": "error",
  "type-evidence/no-unsafe-dictionary-type": "error",
  "type-evidence/no-widen-then-assert": "error",
  "type-evidence/require-safety-comment-for-type-assertion": "error",
};

export default eslintCompatPlugin({
  meta: {
    name: "type-evidence",
  },
  rules: {
    "no-chained-type-assertions": noChainedTypeAssertions,
    "no-known-value-widening": noKnownValueWidening,
    "no-object-parameters": noObjectParameters,
    "no-runtime-typeof": noRuntimeTypeof,
    "no-unknown-parameters": noUnknownParameters,
    "no-unknown-returns": noUnknownReturns,
    "no-unknown-type-aliases": noUnknownTypeAliases,
    "no-unsafe-dictionary-type": noUnsafeDictionaryType,
    "no-widen-then-assert": noWidenThenAssert,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertion,
  },
});
