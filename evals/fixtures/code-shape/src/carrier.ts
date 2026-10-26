import type { Effect } from "effect";
import type { CarrierFailure } from "./errors.ts";
export type Label = { readonly tracking: string };
export interface Carrier {
  readonly createLabel: (input: {
    readonly orderId: string;
    readonly idempotencyKey: string;
  }) => Effect.Effect<Label, CarrierFailure>;
}
