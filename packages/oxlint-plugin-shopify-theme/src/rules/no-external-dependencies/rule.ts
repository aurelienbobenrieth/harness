import type { Rule } from "@oxlint/plugins";

const message =
  "Theme JavaScript must stay dependency-free: use native browser APIs instead of external packages (16 KB bundle budget). Allow deliberate exceptions via the rule's allow option.";

type RuleOptions = { readonly allow?: readonly string[] };

function allowedSpecifiers(context: unknown): readonly string[] {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first !== "object" || first === null) return [];
  const allow = (first as RuleOptions).allow;
  return Array.isArray(allow) ? allow.filter((entry): entry is string => typeof entry === "string") : [];
}

function isAllowedSpecifier(specifier: string, allow: readonly string[]): boolean {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@theme/")) return true;
  return allow.some((allowed) => specifier === allowed || specifier.startsWith(`${allowed}/`));
}

export const noExternalDependencies: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow external package imports in theme JavaScript assets.",
    },
    messages: {
      noExternalDependencies: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        const specifier = node.source.value;
        if (typeof specifier !== "string") return;
        if (isAllowedSpecifier(specifier, allowedSpecifiers(context))) return;
        context.report({ node, messageId: "noExternalDependencies" });
      },
    };
  },
};
