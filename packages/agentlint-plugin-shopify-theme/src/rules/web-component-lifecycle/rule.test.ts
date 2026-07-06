import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { webComponentLifecycle } from "./rule.js";

it("reports custom element registrations", () => {
  const context = createContext({ filename: "assets/cart-drawer.js" });
  const visitors = webComponentLifecycle.createOnce(context);

  visitors.call_expression?.(createNode("call_expression", 'customElements.define("cart-drawer", CartDrawer)'));

  expect(context.messages).toHaveLength(1);
});

it("reports decorator-based registrations", () => {
  const context = createContext({ filename: "assets/cart-drawer.ts" });
  const visitors = webComponentLifecycle.createOnce(context);

  visitors.decorator?.(createNode("decorator", '@customElement("cart-drawer")'));

  expect(context.messages).toHaveLength(1);
});

it("ignores other calls", () => {
  const context = createContext({ filename: "assets/cart-drawer.js" });
  const visitors = webComponentLifecycle.createOnce(context);

  visitors.call_expression?.(createNode("call_expression", 'document.querySelector("cart-drawer")'));

  expect(context.messages).toEqual([]);
});
