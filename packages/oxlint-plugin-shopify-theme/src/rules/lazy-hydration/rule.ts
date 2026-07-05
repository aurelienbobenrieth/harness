import type { Rule } from "@oxlint/plugins";

const message =
  "Enhancer modules must load lazily: replace the static import with a dynamic import() gated on visibility or interaction so first paint ships zero enhancer JavaScript.";

type RuleOptions = { readonly enhancerPattern?: string };

function enhancerPattern(context: unknown): string {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const pattern = (first as RuleOptions).enhancerPattern;
    if (typeof pattern === "string" && pattern.length > 0) return pattern;
  }
  return "-enhancer";
}

function importKindOf(node: unknown): string | undefined {
  const kind = (node as { readonly importKind?: unknown }).importKind;
  return typeof kind === "string" ? kind : undefined;
}

export const lazyHydration: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow static imports of enhancer modules; enhancers register via lazy dynamic import.",
    },
    messages: {
      lazyHydration: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          enhancerPattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (importKindOf(node) === "type") return;
        const specifier = node.source.value;
        if (typeof specifier !== "string") return;
        const moduleName = specifier.split("/").at(-1) ?? specifier;
        if (!moduleName.includes(enhancerPattern(context))) return;
        const specifiers = node.specifiers;
        if (specifiers.length > 0 && specifiers.every((entry) => importKindOf(entry) === "type")) return;
        context.report({ node, messageId: "lazyHydration" });
      },
    };
  },
};
