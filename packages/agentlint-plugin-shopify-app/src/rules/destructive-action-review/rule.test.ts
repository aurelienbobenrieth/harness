import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createJsxOpening } from "../test-support.js";
import { defineDestructiveActionReview, destructiveActionReview } from "./rule.js";

it.each(['"critical"', "{'critical'}"])("reviews the explicit destructive tone %s", (tone) => {
  const context = createContext();
  createVisitors(destructiveActionReview, context).jsx_opening_element?.(createJsxOpening("s-button", { tone }));
  expect(context.messages).toHaveLength(1);
});

it("does not infer destructive actions from nested props, dynamic tones, or critical banners", () => {
  const context = createContext();
  const visitors = createVisitors(destructiveActionReview, context);
  visitors.jsx_opening_element?.(createJsxOpening("s-button", { title: '"tone=critical"' }));
  visitors.jsx_opening_element?.(createJsxOpening("s-button", { tone: "{tone}" }));
  visitors.jsx_opening_element?.(createJsxOpening("s-banner", { tone: '"critical"' }));
  expect(context.messages).toEqual([]);
});

it("supports a project action contract without leaking regex state", () => {
  const context = createContext();
  const visitors = createVisitors(
    defineDestructiveActionReview({
      elementNamePattern: /^Action$/g,
      toneAttribute: "intent",
      destructiveTone: "danger",
    }),
    context,
  );
  for (let index = 0; index < 2; index++)
    visitors.jsx_self_closing_element?.(createJsxOpening("Action", { intent: '"danger"' }, true));
  expect(context.messages).toHaveLength(2);
});
