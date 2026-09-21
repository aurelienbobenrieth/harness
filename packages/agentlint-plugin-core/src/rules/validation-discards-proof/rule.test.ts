import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineValidationDiscardsProof, validationDiscardsProof } from "./rule.js";

const messageFor = (name: string): string =>
  `\`${name}\` checks its argument and returns nothing the type system can carry; return the refined value, or declare an \`asserts\`/\`is\` signature so callers stop re-checking.`;

async function messages(source: string, rule = validationDiscardsProof): Promise<readonly string[]> {
  return (await testRuleOnSource(rule, source, "src/order.ts")).map((finding) => finding.message);
}

it("reports a throwing validator declared void", async () => {
  const source = `
export function validateOrder(order: OrderInput): void {
  if (order.lines.length === 0) throw new Error("Order has no lines");
}`;
  expect(await messages(source)).toEqual([messageFor("validateOrder")]);
});

it("reports a boolean validity check over a structured value", async () => {
  expect(await messages("const isOrderValid = (o: Order): boolean => o.lines.length > 0;")).toEqual([
    messageFor("isOrderValid"),
  ]);
});

it("reports async gates, methods and inferred return types", async () => {
  const asyncGate = `
async function ensureShippable(order: Order): Promise<void> {
  if (!order.address) throw new MissingAddress(order.id);
}`;
  const method = `
class Checkout {
  checkCart(cart: Cart) {
    if (cart.items.length === 0) throw new EmptyCart();
  }
}`;
  const inferredBoolean = `
function verifySignature(request: SignedRequest) {
  if (!request.signature) return false;
  return request.signature === sign(request.body);
}`;
  expect(await messages(asyncGate)).toEqual([messageFor("ensureShippable")]);
  expect(await messages(method)).toEqual([messageFor("checkCart")]);
  expect(await messages(inferredBoolean)).toEqual([messageFor("verifySignature")]);
});

it("stays silent on assertion signatures and type predicates", async () => {
  const asserting = `
function assertOrder(o: OrderInput): asserts o is Order {
  if (o.lines.length === 0) throw new Error("Order has no lines");
}`;
  const predicate = `
function isOrderValid(o: OrderInput): o is Order {
  return o.lines.length > 0;
}`;
  expect(await messages(asserting)).toEqual([]);
  expect(await messages(predicate)).toEqual([]);
  expect(await messages("function isOrder(o: unknown): o is Order { return typeof o === 'object'; }")).toEqual([]);
});

it("stays silent on functions that return the refined value", async () => {
  const parser = `
function parseOrder(input: OrderInput): Order {
  if (input.lines.length === 0) throw new Error("Order has no lines");
  return input as Order;
}`;
  const refining = `
function validateOrder(input: OrderInput): Order {
  if (input.lines.length === 0) throw new Error("Order has no lines");
  return { ...input, lines: input.lines };
}`;
  const inferredValue = `
function ensureOrder(input: OrderInput) {
  if (input.lines.length === 0) throw new Error("Order has no lines");
  return toOrder(input);
}`;
  expect(await messages(parser)).toEqual([]);
  expect(await messages(refining)).toEqual([]);
  expect(await messages(inferredValue)).toEqual([]);
});

it("requires the verb to be a whole name segment", async () => {
  expect(
    await messages("function checkout(cart: Cart): void { if (!cart.id) throw new Error('Cart has no id'); }"),
  ).toEqual([]);
  expect(await messages("function checkoutCart(cart: Cart): void { if (!cart.id) throw new Error('No id'); }")).toEqual(
    [],
  );
});

it("stays silent when every parameter is a primitive or untyped", async () => {
  expect(await messages("function validateEmail(email: string): boolean { return email.includes('@'); }")).toEqual([]);
  expect(
    await messages("function validateInput(input: unknown): void { if (!input) throw new Error('Empty'); }"),
  ).toEqual([]);
  expect(await messages("function validateOrder(order) { if (!order.id) throw new Error('No id'); }")).toEqual([]);
});

it("stays silent when the function neither throws nor inspects its argument", async () => {
  expect(await messages("function checkQuota(account: Account): boolean { return quotaService.hasRoom(); }")).toEqual(
    [],
  );
});

it("accepts a custom name pattern and mirrors it into the binding", async () => {
  const rule = defineValidationDiscardsProof({ namePattern: /^guard[A-Z]/ });
  const source = "function guardOrder(order: OrderInput): void { if (!order.id) throw new Error('No id'); }";
  expect(await messages(source, rule)).toEqual([messageFor("guardOrder")]);
  expect(await messages(source)).toEqual([]);
  expect(rule.binding.options).toEqual({ namePattern: { source: "^guard[A-Z]", flags: "" } });
  expect(validationDiscardsProof.binding.options).toEqual({ namePattern: null });
  expect(validationDiscardsProof.binding.exclude).toEqual(["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"]);
});
