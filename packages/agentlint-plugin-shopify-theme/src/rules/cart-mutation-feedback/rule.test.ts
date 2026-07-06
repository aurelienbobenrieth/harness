import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { cartMutationFeedback } from "./rule.js";

it("reports cart add mutations", () => {
  const context = createContext({ filename: "assets/product-form.js" });
  const visitors = cartMutationFeedback.createOnce(context);

  visitors.call_expression?.(
    createNode("call_expression", 'fetch("/cart/add.js", { method: "POST", body: formData })'),
  );

  expect(context.messages).toHaveLength(1);
});

it("reports cart change mutations", () => {
  const context = createContext({ filename: "assets/cart-drawer.js" });
  const visitors = cartMutationFeedback.createOnce(context);

  visitors.call_expression?.(createNode("call_expression", 'await fetch(`/cart/change.js`, { method: "POST" })'));

  expect(context.messages).toHaveLength(1);
});

it("reports cart mutations built from Shopify route roots", () => {
  const context = createContext({ filename: "assets/product-form.js" });
  const visitors = cartMutationFeedback.createOnce(context);

  visitors.call_expression?.(
    createNode("call_expression", "fetch(Shopify.routes.root + 'cart/add.js', { method: 'POST' })"),
  );

  expect(context.messages).toHaveLength(1);
});

it("ignores cart reads", () => {
  const context = createContext({ filename: "assets/cart-drawer.js" });
  const visitors = cartMutationFeedback.createOnce(context);

  visitors.call_expression?.(createNode("call_expression", 'fetch("/cart.js")'));

  expect(context.messages).toEqual([]);
});
