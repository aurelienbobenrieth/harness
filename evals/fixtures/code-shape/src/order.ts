export type Line = { readonly sku: string; readonly unitCents: number; readonly quantity: number };
export type Order = {
  readonly id: string;
  readonly customerId: string;
  readonly lines: ReadonlyArray<Line>;
  readonly status: "open" | "shipped";
};
