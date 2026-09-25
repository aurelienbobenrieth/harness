/**
 * @attribution code-slop by asyrafhussin (MIT, concept re-implemented) — closing-brace labels and placeholder
 * scaffolding detection; the bare-TODO issue-reference gate and change-narration detection are generic.
 */
import type { ESTree, Rule } from "@oxlint/plugins";

const braceLabelPattern = /(end|close|finish)\b.*(function|class|if|for|foreach|while|switch|block)|^\s*(end|close)\b/i;
const placeholderPattern =
  /^\s*(implementation( here)?|your code here|helper function|placeholder|add your logic( here)?|add error handling|add validation)\s*$/i;
const placeholderTodoPattern = /^TODO:?\s*(implement( this)?|add .*)$/i;
const todoMarkerPattern = /\b(TODO|FIXME)\b/;
const issueReferencePattern = /#\d+|[A-Z]+-\d+|https?:\/\//;
const changeLabelPattern = /^(?:new|updated|changed|fixed|added|removed|modified)\s*:/i;
const formerStatePattern =
  /^(?:(?:previously|formerly)(?:\s*[,:]|\s+(?:this|it|we|was|were|had|called|named)\b)|was:)/i;
const requestedEditPattern =
  /^(?:added|removed)\b.*\b(?:as requested|(?:per|for) (?:the )?(?:review|feedback|pr|request|discussion|ticket)\b)/i;
const editVerbPattern = /^(?:updated|changed|modified|refactored|renamed|moved|migrated)\s+(?:to|from|for)\b/i;
const currentStatePattern = /^(?:now|no longer)\s+(?:uses?|returns?|handles?|supports?)\b/i;

type Comment = ESTree.Comment;

type RuleContextWithSource = {
  readonly sourceCode: {
    readonly lines: readonly string[];
  };
};

function isOnClosingBraceLine(comment: Comment, lines: readonly string[]): boolean {
  const line = lines[comment.loc.start.line - 1] ?? "";
  return line.trimStart().startsWith("}");
}

function isBraceLabel(comment: Comment, lines: readonly string[]): boolean {
  return isOnClosingBraceLine(comment, lines) && braceLabelPattern.test(comment.value);
}

function isPlaceholder(comment: Comment): boolean {
  const text = comment.value.trim();
  return placeholderPattern.test(text) || placeholderTodoPattern.test(text);
}

function isUntrackedTodo(comment: Comment): boolean {
  return todoMarkerPattern.test(comment.value) && !issueReferencePattern.test(comment.value);
}

/**
 * Narration is matched only at the very start of a comment. Elided-subject phrasings ("Updated to…", "Now returns…")
 * double as behavior descriptions in docblocks, so those two shapes are limited to line comments.
 */
function isChangeNarration(comment: Comment): boolean {
  const opening = comment.value.replace(/^[\s*]+/, "");
  if (changeLabelPattern.test(opening) || formerStatePattern.test(opening) || requestedEditPattern.test(opening)) {
    return true;
  }
  return comment.type === "Line" && (editVerbPattern.test(opening) || currentStatePattern.test(opening));
}

export const noDeadComments: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow dead comments: closing-brace labels, placeholder scaffolding, untracked TODOs, and comments narrating a change instead of the code.",
    },
    messages: {
      braceLabel: "Delete this closing-brace label: the brace already says the block ends here.",
      placeholder: "Delete this placeholder comment: write the code it stands in for or remove the stub.",
      changeNarration:
        "Delete this change narration: what the code used to do belongs in the commit message. Keep only what the code does now and why.",
      untrackedTodo: "Track it: TODO(#123), a ticket key, or a link — or delete it.",
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        const lines = (context as RuleContextWithSource).sourceCode.lines;

        for (const comment of node.comments) {
          if (comment.type === "Shebang") continue;

          if (isBraceLabel(comment, lines)) {
            context.report({ node: comment, messageId: "braceLabel" });
            continue;
          }

          if (isPlaceholder(comment)) {
            context.report({ node: comment, messageId: "placeholder" });
            continue;
          }

          if (isUntrackedTodo(comment)) {
            context.report({ node: comment, messageId: "untrackedTodo" });
            continue;
          }

          if (isChangeNarration(comment)) {
            context.report({ node: comment, messageId: "changeNarration" });
          }
        }
      },
    };
  },
};
