import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createJsxOpening } from "../test-support.js";
import { defineModalWorkflowReview, modalWorkflowReview } from "./rule.js";

it.each(["s-modal", "s-app-window"])("reviews %s independently of correct structural props", (name) => {
  const context = createContext();
  createVisitors(modalWorkflowReview, context).jsx_opening_element?.(
    createJsxOpening(name, { heading: '"Archive saved search"' }),
  );
  expect(context.messages).toHaveLength(1);
});

it("ignores non-overlay components and quoted overlay names", () => {
  const context = createContext();
  createVisitors(modalWorkflowReview, context).jsx_opening_element?.(
    createJsxOpening("s-text", { title: '"<s-modal>"' }),
  );
  expect(context.messages).toEqual([]);
});

it("supports project overlays and resets stateful patterns", () => {
  const context = createContext();
  const visitors = createVisitors(defineModalWorkflowReview({ elementNamePattern: /^Dialog$/g }), context);
  for (let index = 0; index < 2; index++) visitors.jsx_self_closing_element?.(createJsxOpening("Dialog", {}, true));
  expect(context.messages).toHaveLength(2);
});
