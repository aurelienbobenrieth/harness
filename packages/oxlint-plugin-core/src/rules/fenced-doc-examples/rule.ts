import type { Rule } from "@oxlint/plugins";

export const fencedDocExamples: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Fence every nonempty JSDoc @example so documentation tools render executable code correctly.",
    },
    messages: { fence: "Wrap this @example in a fenced code block with a language such as ts." },
  },
  createOnce(context) {
    return {
      Program(node) {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== "Block" || !comment.value.startsWith("*")) continue;
          for (const example of comment.value.split(/@example\b/).slice(1)) {
            const body =
              example
                .split(/\n\s*\*?\s*@\w+/)[0]
                ?.replace(/^\s*\* ?/gm, "")
                .trim() ?? "";
            if (body && !/^```\w*\s*\n[\s\S]*\n```\s*$/.test(body)) {
              context.report({ node, loc: comment.loc, messageId: "fence" });
              break;
            }
          }
        }
      },
    };
  },
};
