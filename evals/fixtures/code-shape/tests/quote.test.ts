import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../src/quote.ts";
import { receipt } from "../src/receipt.ts";
test("small orders include handling and tax", () => {
  const order = {
    id: "o1",
    customerId: "c1",
    status: "open" as const,
    lines: [{ sku: "a", unitCents: 1000, quantity: 2 }],
  };
  assert.equal(quote(order), 2800);
  assert.equal(receipt(order), "o1: 2800 cents");
});
test("large orders waive handling", () => {
  const order = {
    id: "o2",
    customerId: "c1",
    status: "open" as const,
    lines: [{ sku: "a", unitCents: 5000, quantity: 1 }],
  };
  assert.equal(quote(order), 6000);
});
