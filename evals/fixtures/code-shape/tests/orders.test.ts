import test from "node:test";
import assert from "node:assert/strict";
import { Effect } from "effect";
import { orders } from "../src/orders.ts";
import { memoryStore } from "../src/memory-store.ts";
test("missing orders fail at the service boundary", async () => {
  const result = await Effect.runPromise(Effect.flip(orders(memoryStore()).find("absent")));
  assert.equal(result._tag, "OrderNotFound");
  assert.equal(result.orderId, "absent");
});
