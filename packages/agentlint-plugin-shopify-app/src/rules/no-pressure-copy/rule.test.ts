import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { defineNoPressureCopy, noPressureCopy } from "./rule.js";

it("reports urgency copy in JSX text", () => {
  const context = createContext();
  const visitors = createVisitors(noPressureCopy, context);

  visitors.jsx_text?.(createNode("jsx_text", "Hurry, this offer ends tonight!"));

  expect(context.messages).toHaveLength(1);
});

it("reports outcome guarantees in strings", () => {
  const context = createContext();
  const visitors = createVisitors(noPressureCopy, context);

  visitors.string?.(createNode("string", '"Guaranteed sales boost within 30 days"'));

  expect(context.messages).toHaveLength(1);
});

it("reports French pressure copy by default", () => {
  const context = createContext();
  const visitors = createVisitors(noPressureCopy, context);

  visitors.jsx_text?.(createNode("jsx_text", "Dernière chance : l'offre expire bientôt !"));

  expect(context.messages).toHaveLength(1);
});

it("reports German pressure copy by default", () => {
  const context = createContext();
  const visitors = createVisitors(noPressureCopy, context);

  visitors.string?.(createNode("string", '"Nur noch 3 verfügbar – jetzt zugreifen!"'));

  expect(context.messages).toHaveLength(1);
});

it("restricts lexicons to the configured languages", () => {
  const englishOnly = defineNoPressureCopy({ languages: ["en"] });
  const context = createContext();
  const visitors = createVisitors(englishOnly, context);

  visitors.jsx_text?.(createNode("jsx_text", "Dernière chance : l'offre expire bientôt !"));

  expect(context.messages).toEqual([]);
});

it("matches project-specific additional patterns", () => {
  const withSpanish = defineNoPressureCopy({ additionalPatterns: [/última oportunidad/iu] });
  const context = createContext();
  const visitors = createVisitors(withSpanish, context);

  visitors.jsx_text?.(createNode("jsx_text", "¡Última oportunidad para ahorrar!"));

  expect(context.messages).toHaveLength(1);
});

it("ignores neutral copy", () => {
  const context = createContext();
  const visitors = createVisitors(noPressureCopy, context);

  visitors.jsx_text?.(createNode("jsx_text", "Configure your shipping rules below."));

  expect(context.messages).toEqual([]);
});
