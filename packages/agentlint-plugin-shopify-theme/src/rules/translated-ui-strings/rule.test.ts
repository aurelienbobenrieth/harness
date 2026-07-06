import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { translatedUiStrings } from "./rule.js";

it("reports hardcoded textContent assignments", () => {
  const context = createContext({ filename: "assets/product-form.js" });
  const visitors = translatedUiStrings.createOnce(context);

  visitors.assignment_expression?.(createNode("assignment_expression", 'button.textContent = "Add to cart"'));

  expect(context.messages).toHaveLength(1);
});

it("reports hardcoded non-English copy", () => {
  const context = createContext({ filename: "assets/product-form.js" });
  const visitors = translatedUiStrings.createOnce(context);

  visitors.assignment_expression?.(createNode("assignment_expression", 'button.textContent = "Ajouter au panier"'));

  expect(context.messages).toHaveLength(1);
});

it("ignores assignments from variables", () => {
  const context = createContext({ filename: "assets/product-form.js" });
  const visitors = translatedUiStrings.createOnce(context);

  visitors.assignment_expression?.(
    createNode("assignment_expression", "button.textContent = this.dataset.addToCartLabel"),
  );

  expect(context.messages).toEqual([]);
});

it("ignores non-text assignments", () => {
  const context = createContext({ filename: "assets/product-form.js" });
  const visitors = translatedUiStrings.createOnce(context);

  visitors.assignment_expression?.(createNode("assignment_expression", 'button.dataset.state = "adding"'));

  expect(context.messages).toEqual([]);
});
