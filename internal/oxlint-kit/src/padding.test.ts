import { describe, expect, it } from "vitest";
import { paddingBetween } from "./padding.js";

/**
 * Build a gap from a template: `«` marks the previous statement's end, `»` the
 * next statement's start, and `[...]` spans are comments. Markers are removed
 * from the returned source; offsets refer to the cleaned text.
 */
function gap(template: string) {
  const comments: [number, number][] = [];
  let source = "";
  let previousEnd = -1;
  let nextStart = -1;
  let commentStart = -1;
  for (const character of template) {
    if (character === "«") previousEnd = source.length;
    else if (character === "»") nextStart = source.length;
    else if (character === "[") commentStart = source.length;
    else if (character === "]") comments.push([commentStart, source.length]);
    else source += character;
  }
  return { source, input: { source, previousEnd, nextStart, comments } };
}

describe("paddingBetween", () => {
  it("accepts a blank line", () => {
    expect(paddingBetween(gap("a();«\n\n  »return;").input)).toEqual({ padded: true });
  });

  it("accepts a blank line holding only indentation", () => {
    expect(paddingBetween(gap("a();«\n  \t\n  »return;").input)).toEqual({ padded: true });
  });

  it("accepts a CRLF blank line and rejects a single CRLF", () => {
    expect(paddingBetween(gap("a();«\r\n\r\n»return;").input)).toEqual({ padded: true });
    expect(paddingBetween(gap("a();«\r\n»return;").input)).toEqual({ padded: false, range: [4, 4], text: "\r\n" });
  });

  it("inserts one line break after the previous statement", () => {
    expect(paddingBetween(gap("a();«\n  »return;").input)).toEqual({ padded: false, range: [4, 4], text: "\n" });
  });

  it("anchors after comments that trail the previous statement", () => {
    expect(paddingBetween(gap("a();« [// x]\n»return;").input)).toEqual({
      padded: false,
      range: [9, 9],
      text: "\n",
    });
  });

  it("anchors above the comment block that leads the next statement", () => {
    expect(paddingBetween(gap("a();«\n[// why]\n»return;").input)).toEqual({
      padded: false,
      range: [4, 4],
      text: "\n",
    });
  });

  it("accepts a blank line between a leading comment and the next statement", () => {
    expect(paddingBetween(gap("a();«\n[// why]\n\n»return;").input)).toEqual({ padded: true });
  });

  it("ignores blank lines inside a comment", () => {
    expect(paddingBetween(gap("a();«\n[/* x\n\n y */]\n»return;").input)).toEqual({
      padded: false,
      range: [4, 4],
      text: "\n",
    });
  });

  it("replaces same-line spacing with a blank line and the line's indentation", () => {
    expect(paddingBetween(gap("  a();« »return;").input)).toEqual({
      padded: false,
      range: [6, 7],
      text: "\n\n  ",
    });
  });
});
