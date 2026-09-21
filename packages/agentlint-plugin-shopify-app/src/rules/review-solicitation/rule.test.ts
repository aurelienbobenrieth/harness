import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { defineReviewSolicitation, reviewSolicitation } from "./rule.js";

it.each(["Leave a review", "Write us a five-star review", "Rate our app", "Laissez votre avis", "Bewerten Sie uns"])(
  "schedules review of %s",
  (text) => {
    const context = createContext();
    createVisitors(reviewSolicitation, context).jsx_text?.(createNode("jsx_text", text));
    expect(context.messages).toHaveLength(1);
  },
);

it("covers locale strings without treating every mention of review as solicitation", () => {
  const context = createContext({ filename: "locales/fr.json" });
  const visitors = createVisitors(reviewSolicitation, context);
  visitors.string?.(createNode("string", '"Laissez un avis"'));
  visitors.string?.(createNode("string", '"Review product details"'));
  visitors.jsx_text?.(createNode("jsx_text", "Reviews imported"));
  expect(context.messages).toHaveLength(1);
});

it("extends defaults with a stateful language pattern", () => {
  const context = createContext();
  const visitors = createVisitors(defineReviewSolicitation({ additionalPatterns: [/tu reseña/gu] }), context);
  visitors.jsx_text?.(createNode("jsx_text", "Comparte tu reseña"));
  visitors.jsx_text?.(createNode("jsx_text", "Comparte tu reseña"));
  visitors.jsx_text?.(createNode("jsx_text", "Rate us"));
  expect(context.messages).toHaveLength(3);
});

it("can use only configured language patterns", () => {
  const context = createContext();
  const visitors = createVisitors(
    defineReviewSolicitation({
      useDefaultPatterns: false,
      additionalPatterns: [/tu reseña/u],
    }),
    context,
  );
  visitors.jsx_text?.(createNode("jsx_text", "Rate us"));
  expect(context.messages).toEqual([]);
});
