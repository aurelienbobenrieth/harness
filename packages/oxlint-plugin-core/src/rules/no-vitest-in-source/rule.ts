import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Vitest imports belong in test files, setup files, config files, or test utilities.";

type RuleContextWithFilename = {
  readonly filename?: string;
  readonly getFilename?: () => string;
};

function getFilename(context: RuleContextWithFilename): string {
  return normalizePath(context.filename ?? context.getFilename?.() ?? "");
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function isAllowedVitestFile(filename: string): boolean {
  return (
    /\.(?:test|spec|it-test)\.[cm]?[tj]sx?$/u.test(filename) ||
    /(?:^|\/)vitest\.(?:config|setup)\.[cm]?[tj]s$/u.test(filename) ||
    filename.includes("/test-utils/") ||
    filename.includes("/testing/")
  );
}

function isVitestImport(node: ESTree.ImportDeclaration): boolean {
  return node.source.value === "vitest";
}

export const noVitestInSource: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing vitest from non-test source files.",
    },
    messages: {
      noVitestInSource: message,
    },
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (!isVitestImport(node)) return;
        if (isAllowedVitestFile(getFilename(context as RuleContextWithFilename))) return;

        context.report({
          node,
          messageId: "noVitestInSource",
        });
      },
    };
  },
};
