import { expect, it } from "vitest";
import { diffRegistries, mergeRegistries, parseMarkdownRegistry } from "./registry.js";

const markdown = `
# Registry

| ID              | Primitive | Status      |
| --------------- | --------- | ----------- |
| layout.surface  | Surface   | implemented |
| content.badge   | Badge     | proposed    |
`;

it("parses markdown table rows with valid ids and statuses", () => {
  expect(parseMarkdownRegistry(markdown)).toEqual([
    { id: "layout.surface", name: "Surface", status: "implemented" },
    { id: "content.badge", name: "Badge", status: "proposed" },
  ]);
});

it("ignores header and separator rows", () => {
  expect(parseMarkdownRegistry("| ID | Primitive | Status |\n| --- | --- | --- |")).toEqual([]);
});

it("diffs markdown against json", () => {
  const drift = diffRegistries(parseMarkdownRegistry(markdown), [
    { id: "layout.surface", status: "proposed" },
    { id: "ghost.entry", status: "implemented" },
  ]);
  expect(drift.missingInJson).toEqual(["content.badge"]);
  expect(drift.extraInJson).toEqual(["ghost.entry"]);
  expect(drift.statusMismatches).toEqual([{ id: "layout.surface", markdown: "implemented", json: "proposed" }]);
});

it("merges while preserving json classification fields", () => {
  const { primitives, summary } = mergeRegistries(parseMarkdownRegistry(markdown), [
    {
      id: "layout.surface",
      name: "Surface",
      status: "proposed",
      surface: "internal",
      delivery: "snippet",
      path: "snippets/surface.liquid",
    },
    { id: "ghost.entry", status: "implemented" },
  ]);

  expect(summary).toEqual({ added: ["content.badge"], updated: ["layout.surface"], removed: ["ghost.entry"] });
  expect(primitives).toEqual([
    {
      id: "layout.surface",
      name: "Surface",
      status: "implemented",
      surface: "internal",
      delivery: "snippet",
      path: "snippets/surface.liquid",
    },
    { id: "content.badge", name: "Badge", status: "proposed" },
  ]);
});
