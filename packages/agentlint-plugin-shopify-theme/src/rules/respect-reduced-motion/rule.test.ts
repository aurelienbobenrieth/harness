import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { defineRespectReducedMotion, respectReducedMotion } from "./rule.js";

it("reports element.animate calls", () => {
  const context = createContext({ filename: "assets/slideshow.js" });
  const visitors = respectReducedMotion.createOnce(context);

  visitors.call_expression?.(
    createNode("call_expression", "slide.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })"),
  );

  expect(context.messages).toHaveLength(1);
});

it("reports smooth scrolling", () => {
  const context = createContext({ filename: "assets/anchor-nav.js" });
  const visitors = respectReducedMotion.createOnce(context);

  visitors.call_expression?.(createNode("call_expression", "target.scrollIntoView({ behavior: 'smooth' })"));

  expect(context.messages).toHaveLength(1);
});

it("ignores motion already gated on reduced motion", () => {
  const context = createContext({ filename: "assets/anchor-nav.js" });
  const visitors = respectReducedMotion.createOnce(context);

  visitors.call_expression?.(
    createNode(
      "call_expression",
      "target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })",
    ),
  );

  expect(context.messages).toEqual([]);
});

it("honors a project motion helper when configured", () => {
  const custom = defineRespectReducedMotion({ motionGuardPattern: /withMotionPreference/ });
  const context = createContext({ filename: "assets/anchor-nav.js" });
  const visitors = custom.createOnce(context);

  visitors.call_expression?.(
    createNode("call_expression", "target.scrollIntoView({ behavior: withMotionPreference('smooth') })"),
  );

  expect(context.messages).toEqual([]);
});

it("ignores instant scrolling", () => {
  const context = createContext({ filename: "assets/anchor-nav.js" });
  const visitors = respectReducedMotion.createOnce(context);

  visitors.call_expression?.(createNode("call_expression", "target.scrollIntoView()"));

  expect(context.messages).toEqual([]);
});
