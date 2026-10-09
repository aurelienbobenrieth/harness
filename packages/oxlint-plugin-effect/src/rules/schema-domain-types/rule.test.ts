import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "effect/schema-domain-types";
const domainFile = { filename: "apps/backend/src/features/orders/_/domain/order.ts" };

it("reports an interface in a domain file", async () => {
  await expect(
    assertRuleReports(ruleName, "export interface Order {\n  readonly id: string;\n}\n", domainFile),
  ).resolves.toBeUndefined();
});

it("reports an object type alias in a domain file", async () => {
  await expect(
    assertRuleReports(ruleName, "export type Order = { readonly id: string };\n", domainFile),
  ).resolves.toBeUndefined();
});

it("reports an object type wrapped in Readonly or an array", async () => {
  await expect(
    assertRuleReports(ruleName, "type Lines = ReadonlyArray<Readonly<{ sku: string }>>;\n", domainFile),
  ).resolves.toBeUndefined();
});

it("reports an intersection that adds hand-written fields to a schema type", async () => {
  await expect(
    assertRuleReports(ruleName, "export type Order = typeof Base.Type & { readonly total: number };\n", domainFile),
  ).resolves.toBeUndefined();
});

it("reports an inline union of variants", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export type Decision = { readonly _tag: "Claim" } | { readonly _tag: "Idle"; readonly reason: string };\n',
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("reports a union of string literals with the Schema.Literals message", async () => {
  await expect(
    reportedMessages(ruleName, 'export type Status = "open" | "closed";\n', domainFile),
  ).resolves.toStrictEqual([
    "Declare these domain literals as Schema.Literals([...]) and derive the type with `type Status = typeof Status.Type`.",
  ]);
});

it("reports an enum", async () => {
  await expect(
    assertRuleReports(ruleName, 'export enum Status {\n  Open = "open",\n}\n', domainFile),
  ).resolves.toBeUndefined();
});

it("allows a schema and its derived type", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export const Order = Schema.Struct({ id: Schema.String });
export type Order = typeof Order.Type;
export const Status = Schema.Literals(["open", "closed"]);
export type Status = typeof Status.Type;
`,
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows a union of schema-derived types and a type computed from one", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `type Settled = Succeeded | Dead;
type OrderTag = Order["_tag"];
type Labels = Readonly<Record<Order["_tag"], string>>;
`,
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows an empty interface that extends a schema type", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export interface Order extends Schema.Schema.Type<typeof OrderSchema> {}\n",
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows generic declarations, which a Schema cannot declare", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export interface Page<Item> {
  readonly items: ReadonlyArray<Item>;
}
export type Move<From, To> = { readonly from: From; readonly to: To };
`,
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows a declaration holding behavior or a runtime handle", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export interface Definition {
  readonly kind: string;
  readonly payload: Schema.Codec<unknown>;
}
export interface Policy {
  readonly name: string;
  readonly decide: (attempt: number) => boolean;
}
export type Port = { readonly name: string; run(): Effect.Effect<void> };
`,
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("reports a declaration whose only Schema member is a JSON value, which is data", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export interface Recorded {\n  readonly type: string;\n  readonly data: Schema.Json;\n}\n",
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows function types", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export type Decide = (order: Order) => boolean;\n", domainFile),
  ).resolves.toBeUndefined();
});

it("ignores files outside domain folders by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export interface Order {\n  readonly id: string;\n}\n", {
      filename: "apps/backend/src/features/orders/_/order-store/service.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores tests in a domain folder by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "interface Case {\n  readonly id: string;\n}\n", {
      filename: "apps/backend/src/features/orders/_/domain/order.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("checks the files a configuration names", async () => {
  await expect(
    assertRuleReports(ruleName, "export interface Order {\n  readonly id: string;\n}\n", {
      filename: "packages/contracts/src/order.ts",
      ruleOptions: { files: ["**/packages/contracts/**"] },
    }),
  ).resolves.toBeUndefined();
});

it("skips the files a configuration allows", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export interface Order {\n  readonly id: string;\n}\n", {
      ...domainFile,
      ruleOptions: { allow: ["**/orders/**"] },
    }),
  ).resolves.toBeUndefined();
});
