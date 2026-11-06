import type { Order } from "./order.ts";
export function quote(order: Order): number {
  const subtotal = order.lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
  const handling = subtotal >= 5000 ? 0 : 400;
  const tax = Math.round(subtotal * 0.2);
  return subtotal + handling + tax;
}
