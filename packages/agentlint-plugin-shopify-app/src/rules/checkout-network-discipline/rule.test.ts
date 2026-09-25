import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { checkoutNetworkDiscipline, defineCheckoutNetworkDiscipline } from "./rule.js";

it("reports fetch calls", () => {
  const context = createContext({ filename: "extensions/checkout-upsell/src/checkout.tsx" });
  const visitors = createVisitors(checkoutNetworkDiscipline, context);

  visitors.call_expression?.(createNode("call_expression", 'fetch("https://app.example.com/offers")'));

  expect(context.messages).toHaveLength(1);
});

it("ignores non-network calls", () => {
  const context = createContext({ filename: "extensions/checkout-upsell/src/checkout.tsx" });
  const visitors = createVisitors(checkoutNetworkDiscipline, context);

  visitors.call_expression?.(createNode("call_expression", "formatMoney(cost.totalAmount)"));

  expect(context.messages).toEqual([]);
});

it("treats shopify.query as network work", () => {
  const context = createContext();
  createVisitors(checkoutNetworkDiscipline, context).call_expression?.(
    createNode("call_expression", 'shopify.query("query { shop { id } }")'),
  );
  expect(context.messages).toHaveLength(1);
});

it("does not alternate findings with a stateful wrapper pattern", () => {
  const context = createContext();
  const visitors = createVisitors(
    defineCheckoutNetworkDiscipline({
      networkCallPattern: /^loadOffers\(/g,
    }),
    context,
  );
  for (let index = 0; index < 2; index++) visitors.call_expression?.(createNode("call_expression", "loadOffers()"));
  expect(context.messages).toHaveLength(2);
});
