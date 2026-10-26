import { Effect } from "effect";
import type { Order } from "./order.ts";
import type { OrderStore } from "./order-store.ts";
export function memoryStore(seed: ReadonlyArray<Order> = []): OrderStore {
  const orders = new Map(seed.map((order) => [order.id, order]));
  return {
    get: (id) => Effect.sync(() => orders.get(id)),
    put: (order) =>
      Effect.sync(() => {
        orders.set(order.id, order);
      }),
  };
}
