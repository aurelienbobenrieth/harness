import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-stubbed-subject";
const cartTest = { filename: "src/cart.test.ts" };

it.each([
  'import * as cart from "./cart"; it("totals", () => { vi.spyOn(cart, "total").mockReturnValue(30); expect(cart.checkout()).toBe(30); });',
  'import * as cart from "./cart.js"; it("totals", () => { vi.spyOn(cart, "load").mockResolvedValueOnce({ id: 1 }); });',
  'import cart from "../cart/index"; it("totals", () => { vi.spyOn(cart, "load").mockImplementation(() => 1); });',
  'import * as cart from "./cart"; it("fails", () => { vi.spyOn(cart, "load").mockName("load").mockRejectedValue(new Error("down")); });',
  'import * as cart from "./cart"; it("totals", () => { const spy = vi.spyOn(cart, "total"); spy.mockReturnValue(30); });',
  'import { vi as mock } from "vitest"; import * as cart from "./cart"; it("totals", () => { mock.spyOn(cart, "total").mockReturnValue(30); });',
])("reports canned behavior on the module under test: %s", async (source) => {
  await assertRuleReports(ruleName, source, cartTest);
});

it.each([
  'import * as cart from "./cart"; it("delegates", () => { const spy = vi.spyOn(cart, "total"); cart.checkout(); expect(spy).toHaveBeenCalledWith(1); });',
  'import * as pricing from "./pricing"; it("totals", () => { vi.spyOn(pricing, "rate").mockReturnValue(2); });',
  'import * as cart from "@shop/cart"; it("totals", () => { vi.spyOn(cart, "total").mockReturnValue(30); });',
  'import { total } from "./cart"; const cart = { total }; it("totals", () => { vi.spyOn(cart, "total").mockReturnValue(30); });',
  'import * as cart from "./cart"; it("totals", () => { spyOn(cart, "total").mockReturnValue(30); });',
  'import * as cart from "./cart"; it("restores", () => { vi.spyOn(cart, "total").mockRestore(); });',
])("stays silent on pass-through spies and collaborators: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, cartTest);
});

it("keys on the test file stem, so another module's test may stub cart", async () => {
  const source = 'import * as cart from "./cart"; it("pays", () => { vi.spyOn(cart, "total").mockReturnValue(30); });';
  await assertRuleDoesNotReport(ruleName, source, { filename: "src/checkout.test.ts" });
  await assertRuleReports(ruleName, source, { filename: "src/cart.spec.tsx" });
});

it("ignores non-test files", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    'import * as cart from "./cart"; vi.spyOn(cart, "total").mockReturnValue(30);',
    { filename: "src/cart.ts" },
  );
});
