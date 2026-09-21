import type { Rule } from "@oxlint/plugins";
import { getFilename, type RuleContextWithFilename } from "../filename-support.js";
import { testApi } from "../test-api-support.js";

const message =
  "Inject deterministic doubles instead of replacing modules. Spies and fake functions can express observable boundary contracts.";
const bannedMethods = new Set(["mock", "doMock", "unmock", "doUnmock"]);

function isAllowedMockingFile(filename: string): boolean {
  return (
    /(?:^|\/)vitest\.(?:config|setup)\.[cm]?[tj]s$/u.test(filename) ||
    filename.includes("/test-utils/") ||
    filename.includes("/testing/")
  );
}

export const noVitestMocking: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Vitest mocking APIs in favor of deterministic test doubles.",
    },
    schema: [
      {
        type: "object",
        properties: { forbidSpies: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: {
      noVitestMocking: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const options = context.options[0] as { forbidSpies?: boolean } | undefined;
        const method = testApi(context, node.callee)?.replace(/^vi\./, "");
        if (
          method === undefined ||
          (!bannedMethods.has(method) && !(options?.forbidSpies === true && ["fn", "spyOn"].includes(method)))
        )
          return;
        if (isAllowedMockingFile(getFilename(context as RuleContextWithFilename))) return;

        context.report({
          node,
          messageId: "noVitestMocking",
        });
      },
    };
  },
};
