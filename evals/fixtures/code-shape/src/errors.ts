export class OrderNotFound extends Error {
  readonly _tag = "OrderNotFound";
  readonly orderId: string;
  constructor(orderId: string) {
    super(`Order ${orderId} was not found`);
    this.orderId = orderId;
  }
}
export class CarrierFailure extends Error {
  readonly _tag = "CarrierFailure";
  readonly retryable: boolean;
  constructor(retryable: boolean) {
    super("Carrier request failed");
    this.retryable = retryable;
  }
}
