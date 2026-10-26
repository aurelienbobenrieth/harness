import type { Rule } from "@oxlint/plugins";
import { staticSql } from "../sql-support.js";

export const constraintNotValid: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Add PostgreSQL foreign-key and CHECK constraints as NOT VALID before validating existing rows separately.",
    },
    messages: {
      deferred: "Add NOT VALID to this foreign-key or CHECK constraint, then validate it in a separate migration.",
    },
  },
  createOnce(context) {
    return {
      TaggedTemplateExpression(node) {
        const text = staticSql(context, node);
        if (text === undefined) return;
        for (const statement of text.split(";")) {
          if (
            /\bALTER\s+TABLE\b[\s\S]*\bADD\s+CONSTRAINT\b[\s\S]*\b(?:FOREIGN\s+KEY|CHECK)\s*\(/i.test(statement) &&
            !/\bNOT\s+VALID\b/i.test(statement)
          ) {
            context.report({ node, messageId: "deferred" });
            break;
          }
        }
      },
    };
  },
};
