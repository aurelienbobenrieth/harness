import type { Rule } from "@oxlint/plugins";
import { moduleMethod } from "../binding-support.js";
import { getFilename, getOptions, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";

const message = "Use a concrete Schema or Schema.Unknown (only when relevant) instead of Schema.Any.";
const defaultAllow = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/fixtures/**",
  "**/scripts/**",
  "tools/**",
];

export const noSchemaAny: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Schema.Any outside configured escape-hatch files.",
    },
    messages: {
      noSchemaAny: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: defaultAllow }],
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        if (moduleMethod(context, node, "Schema") !== "Any") return;

        const options = getOptions(context as RuleContextWithOptions);
        const allow = options.allow ?? defaultAllow;
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;

        context.report({
          node,
          messageId: "noSchemaAny",
        });
      },
    };
  },
};
