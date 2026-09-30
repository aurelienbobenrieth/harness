/**
 * Blank-line padding between two sibling statements, shared by the padding
 * rules of the oxlint plugins.
 *
 * Comments in the gap are split by line: a comment that starts on the line the
 * previous statement ends on trails that statement; every other comment leads
 * the next statement. A gap is padded when any line of it, outside comments,
 * holds only whitespace. The missing padding goes right after the previous
 * statement and its trailing comments, so it lands above the next statement's
 * leading comment block.
 *
 * @module
 */
import type { Context, ESTree } from "@oxlint/plugins";

type SourceRange = [start: number, end: number];

/** The gap between two statements: already padded, or the one text replacement that pads it. */
export type PaddingGap =
  | { readonly padded: true }
  | { readonly padded: false; readonly range: SourceRange; readonly text: string };

/** The gap between two statements: free of blank lines, or the one text replacement that removes them. */
export type UnpaddingGap =
  | { readonly padded: false }
  | { readonly padded: true; readonly range: SourceRange; readonly text: string };

export type PaddingInput = {
  /** Full source text of the file. */
  readonly source: string;
  /** Offset right after the previous statement. */
  readonly previousEnd: number;
  /** Offset of the next statement's first character. */
  readonly nextStart: number;
  /** Ranges of the comments that sit between the two statements, in source order. */
  readonly comments: readonly (readonly [start: number, end: number])[];
};

/** The gap once its comments are split: where the previous statement and its trailing comments end, the comments that lead the next statement, and the whitespace around them. */
type Layout = {
  readonly anchor: number;
  readonly leading: readonly (readonly [start: number, end: number])[];
  /** Whitespace runs from the anchor to the next statement: one before each leading comment, one after the last. */
  readonly whitespace: readonly string[];
};

const lineBreak = /\r\n|\r|\n/;
/** A run holding a blank line: its first line with its line break, then whatever follows up to the last line's indentation. */
const blankLines = /^([^\r\n]*(?:\r\n|\r|\n))\s*(?:\r\n|\r|\n)([^\r\n]*)$/;

function hasLineBreak(text: string): boolean {
  return lineBreak.test(text);
}

function hasBlankLine(text: string): boolean {
  return /\n[ \t]*\n/.test(text.replace(/\r\n?/g, "\n"));
}

/** Leading spaces and tabs of the line that contains `offset`. */
function indentationAt(source: string, offset: number): string {
  const lineStart = Math.max(source.lastIndexOf("\n", offset - 1), source.lastIndexOf("\r", offset - 1)) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? "";
}

function layout(input: PaddingInput): Layout {
  const { source, previousEnd, nextStart } = input;
  const comments = input.comments.filter(([start, end]) => start >= previousEnd && end <= nextStart);

  let anchor = previousEnd;
  let trailing = 0;
  for (const [start, end] of comments) {
    if (hasLineBreak(source.slice(anchor, start))) break;
    anchor = end;
    trailing += 1;
  }

  const leading = comments.slice(trailing);
  const boundaries = [anchor, ...leading.flat(), nextStart];
  const whitespace: string[] = [];
  for (let index = 0; index < boundaries.length; index += 2)
    whitespace.push(source.slice(boundaries[index], boundaries[index + 1]));
  return { anchor, leading, whitespace };
}

/** Measure the gap between two sibling statements and, when it lacks a blank line, the rewrite that adds one. */
export function paddingBetween(input: PaddingInput): PaddingGap {
  const { source } = input;
  const { anchor, whitespace } = layout(input);
  if (whitespace.some(hasBlankLine)) return { padded: true };

  const first = whitespace[0] ?? "";
  const eol = lineBreak.exec(first)?.[0] ?? lineBreak.exec(source)?.[0] ?? "\n";
  if (hasLineBreak(first)) return { padded: false, range: [anchor, anchor], text: eol };
  // Both on one line: move the next statement to its own line, one blank line below.
  return {
    padded: false,
    range: [anchor, anchor + first.length],
    text: `${eol}${eol}${indentationAt(source, anchor)}`,
  };
}

/**
 * Measure the gap between two sibling statements and, when it holds a blank line, the rewrite that removes every
 * blank line outside comments. The comments, one line break per run, and the next line's indentation stay.
 */
export function unpaddingBetween(input: PaddingInput): UnpaddingGap {
  const { anchor, leading, whitespace } = layout(input);
  if (!whitespace.some(hasBlankLine)) return { padded: false };

  const text = whitespace
    .map((run, index) => {
      const comment = leading[index];
      const kept = run.replace(blankLines, "$1$2");
      return comment === undefined ? kept : `${kept}${input.source.slice(comment[0], comment[1])}`;
    })
    .join("");
  return { padded: true, range: [anchor, input.nextStart], text };
}

function gapOf(sourceCode: Context["sourceCode"], previous: ESTree.Node, next: ESTree.Node): PaddingInput {
  return {
    source: sourceCode.text,
    previousEnd: previous.range[1],
    nextStart: next.range[0],
    comments: sourceCode.getCommentsBefore(next).map((comment) => comment.range),
  };
}

/** {@link paddingBetween} for two sibling statements of the file a rule is linting. */
export function statementPadding(
  sourceCode: Context["sourceCode"],
  previous: ESTree.Node,
  next: ESTree.Node,
): PaddingGap {
  return paddingBetween(gapOf(sourceCode, previous, next));
}

/** {@link unpaddingBetween} for two sibling statements of the file a rule is linting. */
export function statementUnpadding(
  sourceCode: Context["sourceCode"],
  previous: ESTree.Node,
  next: ESTree.Node,
): UnpaddingGap {
  return unpaddingBetween(gapOf(sourceCode, previous, next));
}
