import { Effect } from "effect";
import type { OrderStore } from "./order-store.ts";
import { OrderNotFound } from "./errors.ts";
export function orders(store: OrderStore) {
  const find = Effect.fn("orders.find")(function* (id: string) {
    const order = yield* store.get(id);
    if (!order) return yield* Effect.fail(new OrderNotFound(id));
    return order;
  });
  return { find };
}
