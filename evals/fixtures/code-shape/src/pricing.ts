import type { Line } from "./order.ts";
export const subtotal = (lines: ReadonlyArray<Line>): number =>
  lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
export const remaining = (cents: number, percent: number): number =>
  Math.round((cents * percent) / 100);
