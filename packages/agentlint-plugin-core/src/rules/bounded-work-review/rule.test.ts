import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { boundedWorkReview } from "./rule.js";

function createNode(text: string): AgentlintNode {
  return {
    type: "program",
    text,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
    isNamed: true,
    children: [],
    parent: null,
    childCount: 0,
    childByFieldName: () => null,
    childrenByType: () => [],
    descendantsOfType: () => [],
  };
}

function createContext(): RuleContext & { readonly messages: string[] } {
  const messages: string[] = [];

  return {
    messages,
    getFilename: () => "src/handler.ts",
    getFilePath: () => "src/handler.ts",
    getSourceCode: () => "",
    getLinesAround: () => "",
    report: (options) => {
      messages.push(options.message);
    },
  };
}

it("reports sequential awaited I/O", () => {
  const context = createContext();
  const visitors = boundedWorkReview.createOnce(context);

  visitors.program?.(
    createNode(`
await client.users.get(id);
await client.orders.list({ userId: id });
await fetch(url);
`),
  );

  expect(context.messages).toEqual([
    "Program contains sequential I/O, looped I/O, fan-out, or a long runtime budget; review boundedness.",
  ]);
});

it("reports I/O inside loops", () => {
  const context = createContext();
  const visitors = boundedWorkReview.createOnce(context);

  visitors.program?.(
    createNode(`
for (const item of items) {
  await repo.save(item);
}
`),
  );

  expect(context.messages).toEqual([
    "Program contains sequential I/O, looped I/O, fan-out, or a long runtime budget; review boundedness.",
  ]);
});

it("reports Promise.all map fan-out", () => {
  const context = createContext();
  const visitors = boundedWorkReview.createOnce(context);

  visitors.program?.(createNode("await Promise.all(items.map((item) => client.send(item)));\n"));

  expect(context.messages).toEqual([
    "Program contains sequential I/O, looped I/O, fan-out, or a long runtime budget; review boundedness.",
  ]);
});

it("reports long runtime budgets", () => {
  const context = createContext();
  const visitors = boundedWorkReview.createOnce(context);

  visitors.program?.(createNode("export const options = { timeoutMS: 120_000 };\n"));

  expect(context.messages).toEqual([
    "Program contains sequential I/O, looped I/O, fan-out, or a long runtime budget; review boundedness.",
  ]);
});

it("ignores small pure code", () => {
  const context = createContext();
  const visitors = boundedWorkReview.createOnce(context);

  visitors.program?.(createNode("const result = items.map((item) => item.id);\n"));

  expect(context.messages).toEqual([]);
});

it("ignores short explicit budgets", () => {
  const context = createContext();
  const visitors = boundedWorkReview.createOnce(context);

  visitors.program?.(createNode("export const options = { timeoutMS: 5_000 };\n"));

  expect(context.messages).toEqual([]);
});
