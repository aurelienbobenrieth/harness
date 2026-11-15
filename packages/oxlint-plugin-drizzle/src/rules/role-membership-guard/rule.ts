import type { Rule } from "@oxlint/plugins";
import { staticSql } from "../sql-support.js";

export const roleMembershipGuard: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use PostgreSQL role membership rather than current_user equality in SQL policy guards.",
    },
    messages: {
      membership:
        "Use pg_has_role(current_user, role, 'MEMBER') for an inherited-role policy; equality excludes login roles granted that role.",
    },
  },
  createOnce(context) {
    return {
      TaggedTemplateExpression(node) {
        const text = staticSql(context, node);
        if (
          text
            ?.split(";")
            .some((statement) => /\b(?:USING|WITH\s+CHECK)\s*\(\s*current_user\s*=\s*'[^']+'\s*\)/i.test(statement))
        )
          context.report({ node, messageId: "membership" });
      },
    };
  },
};
