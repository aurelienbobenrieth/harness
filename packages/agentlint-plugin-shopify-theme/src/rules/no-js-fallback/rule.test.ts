import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { noJsFallback } from "./rule.js";

it("reports enhancer wrappers without a native fallback", () => {
  const context = createContext({ filename: "blocks/quantity-selector.liquid" });
  const visitors = noJsFallback.createOnce(context);

  visitors.before?.("blocks/quantity-selector.liquid");
  visitors["HtmlElement"]?.(createNode("HtmlElement", '<oio-quantity><div class="stepper"></div></oio-quantity>'));

  expect(context.messages).toEqual([expect.stringContaining("no-JS experience")]);
});

it("accepts wrappers that upgrade a native form", () => {
  const context = createContext({ filename: "blocks/product-form.liquid" });
  const visitors = noJsFallback.createOnce(context);

  visitors["HtmlElement"]?.(
    createNode("HtmlElement", '<oio-product-form><form action="/cart/add" method="post"></form></oio-product-form>'),
  );

  expect(context.messages).toEqual([]);
});

it("ignores regular elements and unrelated files", () => {
  const context = createContext({ filename: "snippets/icon.liquid" });
  const visitors = noJsFallback.createOnce(context);

  expect(visitors.before?.("snippets/icon.liquid")).toBe(false);
  visitors["HtmlElement"]?.(createNode("HtmlElement", "<div><span>copy</span></div>"));
  expect(context.messages).toEqual([]);
});
