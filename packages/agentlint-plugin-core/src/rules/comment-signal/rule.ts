/**
 * Flags narration comments and signature-restating docblocks.
 *
 * @attribution code-slop by asyrafhussin (MIT, concept re-implemented)
 */
import { defineRule, type StateRule } from "@aurelienbbn/agentlint";

const defaultNarrationPattern =
  /^(?:\/\/|\*)\s*(?:create|get|set|return|initialize|loop|check|call|update|send|add|remove)\b/i;
const defaultMinWordOverlapLength = 4;
const maxNarrationWords = 6;
const maxRestatementWords = 0;
const paramLinePattern = /@param\s+(?:\{[^}]*\}\s*)?\[?[\w.$]+\]?\s*(?:-\s*)?(.*)$/;
const returnsLinePattern = /@returns?\b\s*(?:\{[^}]*\}\s*)?(?:-\s*)?(.*)$/;
const commentWordPattern = /[A-Za-z_$][\w$]*/g;

export type CommentSignalOptions = {
  /** Pattern matching narration-suspect line comments when the next source line is unavailable. */
  readonly narrationPattern?: RegExp;
  /** Minimum word length considered when matching comment words against the next source line. */
  readonly minWordOverlapLength?: number;
};

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && word !== "*/").length;
}

function isSignatureRestatement(text: string, javascript: boolean): boolean {
  if (!text.startsWith("/**")) return false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\*\/\s*$/, "");
    const param = paramLinePattern.exec(line);
    if (param) {
      if (javascript && /@param\s+\{/.test(line) && countWords(param[1] ?? "") === 0) continue;
      if (
        countWords(param[1] ?? "") <= maxRestatementWords ||
        /^the [\w ]+(?:id|value|parameter)\s*$/.test(param[1] ?? "")
      )
        return true;
      continue;
    }

    const returns = returnsLinePattern.exec(line);
    if (returns && javascript && /@returns?\s+\{/.test(line) && countWords(returns[1] ?? "") === 0) continue;
    if (returns && (countWords(returns[1] ?? "") <= maxRestatementWords || /^the \w+\s*$/.test(returns[1] ?? "")))
      return true;
  }

  return false;
}

function isNarrationLineComment(
  text: string,
  nextLine: string,
  narrationPattern: RegExp,
  minWordOverlapLength: number,
): boolean {
  if (!text.startsWith("//")) return false;

  const words = text.replace(/^\/\/+\s*/, "").match(commentWordPattern) ?? [];
  if (words.length === 0 || words.length > maxNarrationWords) return false;

  const next = nextLine.trim().toLowerCase();
  if (next.length > 0) {
    narrationPattern.lastIndex = 0;
    if (!narrationPattern.test(text)) return false;
    return words.some((word) => word.length >= minWordOverlapLength && next.includes(word.toLowerCase()));
  }

  narrationPattern.lastIndex = 0;
  return narrationPattern.test(text);
}

export function defineCommentSignal(options: CommentSignalOptions = {}): StateRule {
  options = structuredClone(options);
  const narrationPattern = options.narrationPattern ?? defaultNarrationPattern;
  const minWordOverlapLength = options.minWordOverlapLength ?? defaultMinWordOverlapLength;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/comment-signal",
      revision: 1,
      title: "Comment Signal",
      summary: "Flags comments that narrate the next line or docblocks that restate the signature.",
      guidance: {
        standard:
          "Comments state constraints the code cannot express — as if the project were OSS. A comment that translates the next line, or a docblock that restates the signature, is deleted; public-interface docblocks earn their place with @throws, edge cases, units, or an @example (Effect-style @since/@category/@example discipline).",
        checks: [
          "Narration comments are deleted and the code is self-explanatory.",
          "Docblocks on public exports carry information the signature cannot: @throws, invariants, units, @example.",
          "Constraint comments (SAFETY, protocol quirks, provider limits) stay.",
        ],
      },
    },
    binding: {
      id: "core/comment-signal",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
      exclude: ["**/*.d.ts"],
      options: {
        narrationPattern: options.narrationPattern
          ? { source: options.narrationPattern.source, flags: options.narrationPattern.flags }
          : null,
        minWordOverlapLength: options.minWordOverlapLength ?? null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [{ file: "src/module.ts", source: "/** @returns the user */\nfunction user(){return id}" }],
        mustStaySilent: [
          {
            file: "src/module.ts",
            source: "// Provider limits this batch to 10 items.\nconst size=10;",
          },
        ],
      },
      id: "core/comment-signal",
      version: 1,
      scan: "file",
      createOnce(context) {
        return {
          comment(node) {
            if (isSignatureRestatement(node.text, /\.[cm]?jsx?$/.test(context.path))) {
              context.report({
                node,
                message:
                  "Docblock restates the signature; document @throws, invariants, units, or an @example instead.",
              });
              return;
            }

            let nextLine = (context.source.split("\n")[node.endPosition.row + 1] ?? "").replace(
              /^\s*\d+\s*[:|]\s*/,
              "",
            );
            if (nextLine.includes(node.text)) nextLine = "";
            if (!isNarrationLineComment(node.text, nextLine, narrationPattern, minWordOverlapLength)) return;

            context.report({
              node,
              message: "Comment narrates the adjacent code; delete it or state a constraint the code cannot express.",
            });
          },
        };
      },
    },
  });
}

export const commentSignal = defineCommentSignal();
