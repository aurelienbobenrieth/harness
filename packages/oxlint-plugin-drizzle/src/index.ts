import { constraintNotValid } from "./rules/constraint-not-valid/rule.js";
import { requireRetentionComment } from "./rules/require-retention-comment/rule.js";
import { roleMembershipGuard } from "./rules/role-membership-guard/rule.js";
import { eslintCompatPlugin } from "@oxlint/plugins";
import { fkColumnIndexed } from "./rules/fk-column-indexed/rule.js";

/** Advisory defaults for newly introduced or low-precision rules; merge into consumer rules. */
export const advisoryRules = {
  "drizzle/constraint-not-valid": "warn",
  "drizzle/require-retention-comment": "warn",
  "drizzle/role-membership-guard": "warn",
} as const;

export default eslintCompatPlugin({
  meta: {
    name: "drizzle",
  },
  rules: {
    "constraint-not-valid": constraintNotValid,
    "require-retention-comment": requireRetentionComment,
    "role-membership-guard": roleMembershipGuard,

    "fk-column-indexed": fkColumnIndexed,
  },
});
