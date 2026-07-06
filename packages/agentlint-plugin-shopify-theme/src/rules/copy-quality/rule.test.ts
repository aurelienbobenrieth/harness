import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { copyQuality } from "./rule.js";

it("reports click-here copy", () => {
  const context = createContext({ filename: "blocks/button.liquid" });
  const visitors = copyQuality.createOnce(context);

  visitors["TextNode"]?.(createNode("TextNode", "Click here to see our products"));

  expect(context.messages).toEqual([expect.stringContaining("name the action")]);
});

it("reports shouting copy", () => {
  const context = createContext({ filename: "blocks/announcement.liquid" });
  const visitors = copyQuality.createOnce(context);

  visitors["TextNode"]?.(createNode("TextNode", "FREE SHIPPING ON ALL ORDERS!"));

  expect(context.messages).toEqual([expect.stringContaining("sentence case")]);
});

it("ignores liquid output and sentence-case copy", () => {
  const context = createContext({ filename: "blocks/button.liquid" });
  const visitors = copyQuality.createOnce(context);

  visitors["TextNode"]?.(createNode("TextNode", "{{ 'cart.checkout' | t }}"));
  visitors["TextNode"]?.(createNode("TextNode", "Add to cart"));

  expect(context.messages).toEqual([]);
});
