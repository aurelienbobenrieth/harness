import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Prefer manual fakes, in-memory adapters, or deterministic doubles instead of Vitest mocking APIs.";
const bannedMethods = new Set(["fn", "mock", "spyOn"]);

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

function isAllowedMockingFile(filename: string): boolean {
  return (
    /(?:^|\/)vitest\.(?:config|setup)\.[cm]?[tj]s$/u.test(filename) ||
    filename.includes("/test-utils/") ||
    filename.includes("/testing/")
  );
}

function isVitestMockingCall(node: ESTree.CallExpression): boolean {
  if (node.callee.type !== "MemberExpression") return false;
  if (node.callee.object.type !== "Identifier" || node.callee.object.name !== "vi") return false;
  if (node.callee.property.type !== "Identifier") return false;

  return bannedMethods.has(node.callee.property.name);
}

export const noVitestMocking: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Vitest mocking APIs in favor of deterministic test doubles.",
    },
    messages: {
      noVitestMocking: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isVitestMockingCall(node)) return;
        if (isAllowedMockingFile(getFilename(context as RuleContextWithFilename))) return;

        context.report({
          node,
          messageId: "noVitestMocking",
        });
      },
    };
  },
};
