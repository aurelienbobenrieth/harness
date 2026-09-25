import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createJsxOpening, createNode, createTreeNode } from "../test-support.js";
import { actionLabelClarity, defineActionLabelClarity } from "./rule.js";

it.each(["OK", "Yes", "Submit", "Click here"])("reviews ambiguous action text %s", (label) => {
  const context = createContext();
  const text = createNode("jsx_text", label);
  createTreeNode("jsx_element", "", [createJsxOpening("s-button"), text]);
  createVisitors(actionLabelClarity, context).jsx_text?.(text);
  expect(context.messages).toHaveLength(1);
});

it("reviews a direct JSX string expression", () => {
  const context = createContext();
  const text = createNode("string", '"Yes"');
  createTreeNode("jsx_element", "", [
    createJsxOpening("s-button"),
    createTreeNode("jsx_expression", '{"Yes"}', [text]),
  ]);
  createVisitors(actionLabelClarity, context).string?.(text);
  expect(context.messages).toHaveLength(1);
});

it("ignores normal text, unscoped strings, and clear labels", () => {
  const context = createContext();
  const visitors = createVisitors(actionLabelClarity, context);
  const text = createNode("jsx_text", "Yes");
  createTreeNode("jsx_element", "", [createJsxOpening("s-paragraph"), text]);
  visitors.jsx_text?.(text);
  visitors.string?.(createNode("string", '"Yes"'));
  const clear = createNode("jsx_text", "Archive saved search");
  createTreeNode("jsx_element", "", [createJsxOpening("s-button"), clear]);
  visitors.jsx_text?.(clear);
  expect(context.messages).toEqual([]);
});

it("configures translated labels and wrappers without regex state leaks", () => {
  const context = createContext();
  const visitors = createVisitors(
    defineActionLabelClarity({
      elementNamePattern: /^Action$/g,
      ambiguousLabelPatterns: [/^Oui$/g],
    }),
    context,
  );
  for (let index = 0; index < 2; index++) {
    const text = createNode("jsx_text", "Oui");
    createTreeNode("jsx_element", "", [createJsxOpening("Action"), text]);
    visitors.jsx_text?.(text);
  }
  expect(context.messages).toHaveLength(2);
});
