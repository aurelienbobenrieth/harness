import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { preferSchemaContracts } from "./rule.js";

function createNode(type: string, text: string): AgentlintNode {
  return {
    type,
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
    getFilename: () => "sample.ts",
    getFilePath: () => "sample.ts",
    getSourceCode: () => "",
    getLinesAround: () => "",
    report: (options) => {
      messages.push(options.message);
    },
  };
}

it("reports exported interfaces", () => {
  const context = createContext();
  const visitors = preferSchemaContracts.createOnce(context);

  visitors.interface_declaration?.(
    createNode("interface_declaration", "export interface User { id: string }"),
  );

  expect(context.messages).toEqual([
    "Exported interface needs an Effect Schema source of truth or an explicit non-runtime reason.",
  ]);
});

it("reports exported object type aliases", () => {
  const context = createContext();
  const visitors = preferSchemaContracts.createOnce(context);

  visitors.type_alias_declaration?.(
    createNode("type_alias_declaration", "export type User = { id: string }"),
  );

  expect(context.messages).toEqual([
    "Exported object type needs an Effect Schema source of truth or an explicit non-runtime reason.",
  ]);
});

it("ignores schema derived type aliases", () => {
  const context = createContext();
  const visitors = preferSchemaContracts.createOnce(context);

  visitors.type_alias_declaration?.(
    createNode("type_alias_declaration", "export type User = typeof User.Type;"),
  );

  expect(context.messages).toEqual([]);
});

it("ignores local interfaces", () => {
  const context = createContext();
  const visitors = preferSchemaContracts.createOnce(context);

  visitors.interface_declaration?.(
    createNode("interface_declaration", "interface User { id: string }"),
  );

  expect(context.messages).toEqual([]);
});

it("ignores union type aliases", () => {
  const context = createContext();
  const visitors = preferSchemaContracts.createOnce(context);

  visitors.type_alias_declaration?.(
    createNode("type_alias_declaration", 'export type Status = "idle" | "done";'),
  );

  expect(context.messages).toEqual([]);
});
