import type { ESTree, Rule } from "@oxlint/plugins";
import { getFilename, isTestSupportFile, type RuleContextWithFilename } from "../filename-support.js";

const message = "Vitest imports belong in test files, setup files, config files, or test utilities.";

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
        if (isTestSupportFile(getFilename(context as RuleContextWithFilename))) return;

        context.report({
          node,
          messageId: "noVitestInSource",
        });
      },
    };
  },
};
