import { createVisitors } from "../test-support.js";
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
    path: "sample.ts",
    absolutePath: "sample.ts",
    source: "",
    dependencies: {},
    report: (options) => {
      messages.push(options.message);
    },
  };
}

it("reports exported interfaces", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.interface_declaration?.(createNode("interface_declaration", "export interface User { id: string }"));

  expect(context.messages).toEqual([
    "Exported interface needs an Effect Schema source of truth or an explicit non-runtime reason.",
  ]);
});

it("reports exported object type aliases", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.type_alias_declaration?.(createNode("type_alias_declaration", "export type User = { id: string }"));

  expect(context.messages).toEqual([
    "Exported object type needs an Effect Schema source of truth or an explicit non-runtime reason.",
  ]);
});

it("ignores schema derived type aliases", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.type_alias_declaration?.(createNode("type_alias_declaration", "export type User = typeof User.Type;"));

  expect(context.messages).toEqual([]);
});

it("ignores local interfaces", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.interface_declaration?.(createNode("interface_declaration", "interface User { id: string }"));

  expect(context.messages).toEqual([]);
});

it("ignores union type aliases", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.type_alias_declaration?.(createNode("type_alias_declaration", 'export type Status = "idle" | "done";'));

  expect(context.messages).toEqual([]);
});

it.each([
  'export type User = typeof User["Type"];',
  'export type UserEncoded = typeof User["Encoded"]',
  "export type UserEncoded = typeof User.Encoded;",
  "export type User = Schema.Schema.Type<typeof User>;",
  "export type UserEncoded = Schema.Codec.Encoded<typeof User>;",
])("treats %s as schema derived", (source) => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.type_alias_declaration?.(createNode("type_alias_declaration", source));

  expect(context.messages).toEqual([]);
});

it("ignores empty interfaces that extend a schema-derived type", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.interface_declaration?.(
    createNode("interface_declaration", "export interface User extends Schema.Schema.Type<typeof UserSchema> {}"),
  );

  expect(context.messages).toEqual([]);
});

it("reports interfaces that add manual members to a schema-derived type", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.interface_declaration?.(
    createNode(
      "interface_declaration",
      "export interface User extends Schema.Schema.Type<typeof UserSchema> { readonly role: string }",
    ),
  );

  expect(context.messages).toHaveLength(1);
});

it("reports interfaces that extend a manual type", () => {
  const context = createContext();
  const visitors = createVisitors(preferSchemaContracts, context);

  visitors.interface_declaration?.(createNode("interface_declaration", "export interface User extends Base {}"));

  expect(context.messages).toHaveLength(1);
});
