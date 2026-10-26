import type { Effect } from "effect";
import type { Order } from "./order.ts";
export interface OrderStore {
  readonly get: (id: string) => Effect.Effect<Order | undefined>;
  readonly put: (order: Order) => Effect.Effect<void>;
}
