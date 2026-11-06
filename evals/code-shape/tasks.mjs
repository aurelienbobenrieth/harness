export const tasks = [
  {
    id: "boundary",
    prompt:
      "Add api.summary(id) behind the existing order-service boundary. Return exactly {id, customerId, itemCount, subtotalCents, status}; itemCount sums quantities. Missing IDs must retain OrderNotFound. Keep existing APIs compatible and cover the behavior with tests.",
  },
  {
    id: "duplication",
    prompt:
      "Quote and receipt duplicate the fulfillment total calculation. Consolidate the pricing decision while preserving both public contracts. Handling is 400 cents below subtotal 5000, otherwise zero; tax is rounded 20% of subtotal. Cover 4999, 5000, and rounding; avoid introducing pass-through modules.",
  },
  {
    id: "retry",
    prompt:
      "Make the carrier call in shipping retry transient CarrierFailure(retryable=true), at most 3 total attempts, with a bounded Effect schedule. Never retry permanent failures. Every attempt uses the same ship:<orderId> idempotency key. Do not persist shipped on failure. Cover success after transient failures, exhaustion, permanent failure and unchanged state. Tests must not sleep in real time.",
  },
  {
    id: "regression",
    prompt:
      "Fix api.discounted: a 20% discount on a 2000-cent subtotal must leave 1600 cents, currently it leaves 400. Round once to nearest cent. Add boundary regression tests for 0%, 100%, a fractional-cent result, and the reported bug. Preserve the existing error contract.",
  },
];
