import { Effect } from "effect";
import type { OrderStore } from "./order-store.ts";
import type { Carrier } from "./carrier.ts";
import { orders } from "./orders.ts";
import { quote } from "./quote.ts";
import { receipt } from "./receipt.ts";
import { shipping } from "./shipping.ts";
import { remaining, subtotal } from "./pricing.ts";
export function api(store: OrderStore, carrier: Carrier) {
  const service = orders(store);
  return {
    quote: (id: string) => Effect.map(service.find(id), quote),
    receipt: (id: string) => Effect.map(service.find(id), receipt),
    discounted: (id: string, percent: number) =>
      Effect.map(service.find(id), (order) => remaining(subtotal(order.lines), percent)),
    ship: shipping(store, carrier),
  };
}
