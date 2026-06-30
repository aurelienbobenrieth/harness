import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

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

type RuleOptions = {
  readonly allow?: readonly string[];
};

type RuleContextWithOptions = {
  readonly filename?: string;
  readonly getFilename?: () => string;
  readonly options?: readonly unknown[];
};

function getFilename(context: RuleContextWithOptions): string {
  return context.filename ?? context.getFilename?.() ?? "";
}

function getOptions(context: RuleContextWithOptions): RuleOptions {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null || !("allow" in candidate)) return {};

  const allow = (candidate as { readonly allow?: unknown }).allow;
  return Array.isArray(allow) && allow.every((entry) => typeof entry === "string") ? { allow } : {};
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob: string): RegExp {
  let pattern = "";
  const normalized = normalizePath(glob);

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized.charAt(index);
    const next = normalized.charAt(index + 1);
    const afterNext = normalized.charAt(index + 2);

    if (character === "*" && next === "*" && afterNext === "/") {
      pattern += "(?:.*/)?";
      index += 2;
      continue;
    }

    if (character === "*" && next === "*") {
      pattern += ".*";
      index += 1;
      continue;
    }

    if (character === "*") {
      pattern += "[^/]*";
      continue;
    }

    pattern += escapeRegExp(character);
  }

  return new RegExp(`^${pattern}$`, "u");
}

function isAllowedFile(filename: string, patterns: readonly string[]): boolean {
  const normalized = normalizePath(filename);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

function isSchemaAnyReference(node: ESTree.Node): boolean {
  return isMemberExpression(node, "Schema", "Any");
}

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
        if (!isSchemaAnyReference(node)) return;

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
