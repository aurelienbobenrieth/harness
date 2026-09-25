import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { commentSignal, defineCommentSignal } from "./rule.js";

it("reports docblocks whose @param lines restate the signature", () => {
  const context = createContext();
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(
    createNode(
      "comment",
      `/**
 * Gets a user.
 * @param id the user id
 */`,
    ),
  );

  expect(context.messages).toEqual([
    "Docblock restates the signature; document @throws, invariants, units, or an @example instead.",
  ]);
});

it("reports docblocks whose @returns line restates the signature", () => {
  const context = createContext();
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(
    createNode(
      "comment",
      `/**
 * @returns the user
 */`,
    ),
  );

  expect(context.messages).toHaveLength(1);
});

it("reports line comments that narrate the next source line", () => {
  const context = createContext({ linesAround: () => "const user = createUser(input);" });
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(createNode("comment", "// create the user record", 4));

  expect(context.messages).toEqual([
    "Comment narrates the adjacent code; delete it or state a constraint the code cannot express.",
  ]);
});

it("reports imperative narration comments when the next line is unavailable", () => {
  const context = createContext();
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(createNode("comment", "// initialize the cache"));

  expect(context.messages).toHaveLength(1);
});

it("ignores constraint comments", () => {
  const context = createContext({ linesAround: () => "await sendPayload(chunked);" });
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(createNode("comment", "// SAFETY: provider rejects payloads over 1MB, chunk before sending"));

  expect(context.messages).toEqual([]);
});

it("ignores docblocks that document invariants, units, and examples", () => {
  const context = createContext();
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(
    createNode(
      "comment",
      `/**
 * @param delay Duration in milliseconds; values above 60s trip the provider budget.
 * @throws RangeError when delay is negative or not finite.
 * @example retry(task, { delay: 250 })
 */`,
    ),
  );

  expect(context.messages).toEqual([]);
});

it("ignores short comments with no overlap and no narration verb", () => {
  const context = createContext({ linesAround: () => "const x = 1;" });
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(createNode("comment", "// legacy quirk"));

  expect(context.messages).toEqual([]);
});

it("falls back to the narration pattern when getLinesAround returns the comment itself", () => {
  const context = createContext({ linesAround: () => "// legacy quirk" });
  const visitors = createVisitors(commentSignal, context);

  visitors.comment?.(createNode("comment", "// legacy quirk"));

  expect(context.messages).toEqual([]);
});

it("supports a custom narration pattern", () => {
  const rule = defineCommentSignal({ narrationPattern: /^\/\/\s*handle\b/i });
  const context = createContext();
  const visitors = createVisitors(rule, context);

  visitors.comment?.(createNode("comment", "// handle the submit"));

  expect(context.messages).toHaveLength(1);
});
