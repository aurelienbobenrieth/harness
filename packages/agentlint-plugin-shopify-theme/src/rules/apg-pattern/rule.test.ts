import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { apgPattern } from "./rule.js";

it("reports composite roles for APG review", () => {
  const context = createContext({ filename: "sections/cart-drawer.liquid" });
  const visitors = apgPattern.createOnce(context);

  visitors["HtmlElement"]?.(createNode("HtmlElement", '<div role="dialog" aria-modal="true">…</div>'));

  expect(context.messages).toEqual([expect.stringContaining("APG dialog pattern")]);
});

it("ignores simple roles and plain elements", () => {
  const context = createContext({ filename: "sections/header.liquid" });
  const visitors = apgPattern.createOnce(context);

  visitors["HtmlElement"]?.(createNode("HtmlElement", '<nav role="navigation"><a href="/">Home</a></nav>'));
  visitors["HtmlElement"]?.(createNode("HtmlElement", "<div><span>copy</span></div>"));

  expect(context.messages).toEqual([]);
});

it("only matches roles on the opening tag", () => {
  const context = createContext({ filename: "sections/menu.liquid" });
  const visitors = apgPattern.createOnce(context);

  visitors["HtmlElement"]?.(createNode("HtmlElement", '<div><ul role="menu"></ul></div>'));

  expect(context.messages).toEqual([]);
});
