import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createJsxOpening } from "../test-support.js";
import { bannerUsage, defineBannerUsage } from "./rule.js";

it.each([false, true])("reviews a banner even with a dismissal prop (self-closing=%s)", (selfClosing) => {
  const context = createContext();
  const node = createJsxOpening("s-banner", { dismissible: true }, selfClosing);
  const visitors = createVisitors(bannerUsage, context);
  const check = selfClosing ? visitors.jsx_self_closing_element : visitors.jsx_opening_element;
  check?.(node);
  expect(context.messages).toHaveLength(1);
});

it("ignores names and prop contents that resemble a banner", () => {
  const context = createContext();
  const visitors = createVisitors(bannerUsage, context);
  for (const name of ["Banner", "s-banner-group", "div"])
    visitors.jsx_opening_element?.(createJsxOpening(name, { title: '"<s-banner>"' }));
  expect(context.messages).toEqual([]);
});

it("supports an explicit wrapper and resets stateful patterns", () => {
  const context = createContext();
  const visitors = createVisitors(defineBannerUsage({ elementNamePattern: /^Notice$/g }), context);
  visitors.jsx_opening_element?.(createJsxOpening("Notice"));
  visitors.jsx_opening_element?.(createJsxOpening("Notice"));
  visitors.jsx_opening_element?.(createJsxOpening("s-banner"));
  expect(context.messages).toHaveLength(2);
});
