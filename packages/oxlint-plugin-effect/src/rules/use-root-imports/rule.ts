import type { Rule } from "@oxlint/plugins";

const message = 'Import stable Effect modules from "effect" instead of stable effect/* subpaths.';

function getImportSource(node: { readonly source?: { readonly value?: unknown } }): string | undefined {
  return typeof node.source?.value === "string" ? node.source.value : undefined;
}

function isDisallowedEffectSubpath(source: string): boolean {
  return source.startsWith("effect/") && !source.startsWith("effect/unstable/");
}

export const useRootImports: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require root imports for stable Effect modules.",
    },
    messages: {
      rootImport: message,
    },
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        const source = getImportSource(node);
        if (source === undefined || !isDisallowedEffectSubpath(source)) return;

        context.report({
          node,
          messageId: "rootImport",
        });
      },
    };
  },
};
