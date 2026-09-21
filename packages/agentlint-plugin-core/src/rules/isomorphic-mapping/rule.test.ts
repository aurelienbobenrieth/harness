import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineIsomorphicMapping, isomorphicMapping } from "./rule.js";

const messageFor = (identity: number, properties: number): string =>
  `Function copies ${identity} of ${properties} members straight from its argument into a same-shaped object; name the boundary that separates the two types, or use one type and delete the mapper.`;
const message = messageFor(5, 5);

async function findings(source: string, rule = isomorphicMapping, file = "src/user-mapper.ts") {
  return testRuleOnSource(rule, source, file);
}

async function messages(source: string, rule = isomorphicMapping): Promise<readonly string[]> {
  return (await findings(source, rule)).map((finding) => finding.message);
}

it("reports a named mapper made of identity pairs", async () => {
  const source = `
export function toUserModel(entity: UserEntity): UserModel {
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    role: entity.role,
    createdAt: entity.createdAt,
  };
}`;
  expect(await messages(source)).toEqual([message]);
});

it("reports an inline arrow mapper, nullish defaults included", async () => {
  const source =
    "const views = rows.map((r) => ({ id: r.id, sku: r.sku, title: r.title, price: r.price, note: r.note ?? null }));";
  expect(await messages(source)).toEqual([message]);
});

it("counts shorthand members bound by destructuring the parameter", async () => {
  const fromPattern = "const toView = ({ id, sku, title, price, stock }) => ({ id, sku, title, price, stock });";
  const fromBody = `
function toView(product) {
  const { id, sku, title } = product;
  return { id, sku, title, price: product.price, stock: product.stock };
}`;
  expect(await messages(fromPattern)).toEqual([message]);
  expect(await messages(fromBody)).toEqual([message]);
});

it("stays silent on shorthand members that come from elsewhere", async () => {
  const source = `
function toView(product) {
  const { id, sku, title, price, stock } = loadDefaults();
  return { id, sku, title, price, stock };
}`;
  expect(await messages(source)).toEqual([]);
});

it("stays silent when the mapper renames or formats its fields", async () => {
  const source = `
function toInvoiceResponse(invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    issued_at: invoice.issuedAt.toISOString(),
    total_cents: invoice.total.cents,
    customer: { id: invoice.customerId },
    label: \`\${invoice.number} / \${invoice.currency}\`,
  };
}`;
  expect(await messages(source)).toEqual([]);
});

it("stays silent below the property threshold", async () => {
  expect(await messages("const toView = (p) => ({ id: p.id, sku: p.sku, title: p.title, price: p.price });")).toEqual(
    [],
  );
});

it("stays silent when fewer than nine members in ten are identity copies", async () => {
  expect(
    await messages(
      "const toView = (p) => ({ id: p.id, sku: p.sku, title: p.title, price: p.price, label: format(p.title) });",
    ),
  ).toEqual([]);
});

it("treats a renamed key and a read from another object as non-identity", async () => {
  expect(
    await messages("const toView = (p) => ({ id: p.id, sku: p.sku, title: p.title, price: p.price, name: p.title });"),
  ).toEqual([]);
  expect(
    await messages("const toView = (p) => ({ id: p.id, sku: p.sku, title: p.title, price: p.price, stock: q.stock });"),
  ).toEqual([]);
});

it("stays silent on a spread that adds a computed member", async () => {
  expect(await messages("const withTotal = (p) => ({ ...p, total: compute(p) });")).toEqual([]);
});

it("stays silent on functions with two parameters", async () => {
  expect(
    await messages(
      "const merge = (p, extra) => ({ id: p.id, sku: p.sku, title: p.title, price: p.price, stock: p.stock });",
    ),
  ).toEqual([]);
});

it("states the counts and honours thresholds", async () => {
  const source = "const toView = (p) => ({ id: p.id, sku: p.sku, title: p.title, label: format(p.title) });";
  expect(await messages(source, defineIsomorphicMapping({ minProperties: 4, identityRatio: 0.75 }))).toEqual([
    messageFor(3, 4),
  ]);
  expect(await messages(source)).toEqual([]);
});

it("mirrors options into the binding and keeps test files out of scope", () => {
  expect(isomorphicMapping.binding.options).toEqual({ minProperties: null, identityRatio: null });
  expect(defineIsomorphicMapping({ minProperties: 3, identityRatio: 1 }).binding.options).toEqual({
    minProperties: 3,
    identityRatio: 1,
  });
  expect(isomorphicMapping.binding.exclude).toEqual(["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"]);
  expect(() => defineIsomorphicMapping({ identityRatio: 0 })).toThrow("identityRatio");
});
