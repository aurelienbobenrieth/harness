import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { schemaUx } from "./rule.js";

const schema = (groups: unknown[]): string => JSON.stringify(groups);

it("reports hardcoded labels", () => {
  const source = schema([{ name: "t:settings.colors", settings: [{ type: "color", id: "accent", label: "Accent" }] }]);
  const context = createContext({ filename: "config/settings_schema.json", sourceCode: source });
  const visitors = schemaUx.createOnce(context);

  visitors.before?.("config/settings_schema.json");
  visitors["document"]?.(createNode("document", source));

  expect(context.messages).toEqual([expect.stringContaining("hardcoded label")]);
});

it("reports long flat groups without headers", () => {
  const settings = Array.from({ length: 10 }, (_, index) => ({
    type: "text",
    id: `setting_${index}`,
    label: `t:settings.s${index}`,
  }));
  const source = schema([{ name: "t:settings.layout", settings }]);
  const context = createContext({ filename: "config/settings_schema.json", sourceCode: source });
  const visitors = schemaUx.createOnce(context);

  visitors.before?.("config/settings_schema.json");
  visitors["document"]?.(createNode("document", source));

  expect(context.messages).toEqual([expect.stringContaining("without header grouping")]);
});

it("accepts translated, grouped schemas", () => {
  const source = schema([
    {
      name: "t:settings.colors",
      settings: [
        { type: "header", content: "t:settings.brand" },
        { type: "color", id: "accent", label: "t:settings.accent" },
      ],
    },
  ]);
  const context = createContext({ filename: "config/settings_schema.json", sourceCode: source });
  const visitors = schemaUx.createOnce(context);

  visitors.before?.("config/settings_schema.json");
  visitors["document"]?.(createNode("document", source));

  expect(context.messages).toEqual([]);
});

it("skips unrelated json files", () => {
  const context = createContext({ filename: "templates/index.json", sourceCode: "{}" });
  const visitors = schemaUx.createOnce(context);

  expect(visitors.before?.("templates/index.json")).toBe(false);
});
