import { Effect } from "effect";
import type { Carrier } from "./carrier.ts";
import type { OrderStore } from "./order-store.ts";
import { orders } from "./orders.ts";
export function shipping(store: OrderStore, carrier: Carrier) {
  return Effect.fn("shipping.ship")(function* (id: string) {
    const order = yield* orders(store).find(id);
    const label = yield* carrier.createLabel({ orderId: id, idempotencyKey: `ship:${id}` });
    yield* store.put({ ...order, status: "shipped" });
    return label;
  });
}
