import { expect, it } from "vitest";
import { eventContract } from "./event-contract.js";
import { createFixture } from "./test-support.js";

const contract = JSON.stringify({ events: [{ name: "oio:cart:updated" }] });

it("passes when used events are declared", async () => {
  const root = await createFixture({
    "frontend/features/storefront-events/events.json": contract,
    "frontend/features/cart/cart-enhancer.ts": 'this.dispatchEvent(new CustomEvent("oio:cart:updated"));',
  });
  expect(await eventContract.run({ root })).toEqual([]);
});

it("reports a missing contract file", async () => {
  const root = await createFixture({});
  const findings = await eventContract.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("events.json is missing")]);
});

it("reports undeclared events", async () => {
  const root = await createFixture({
    "frontend/features/storefront-events/events.json": contract,
    "frontend/features/cart/cart-enhancer.ts": 'document.addEventListener("oio:cart:ghost", handler);',
  });
  const findings = await eventContract.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining('"oio:cart:ghost" which is not declared'),
    expect.stringContaining('"oio:cart:updated" that no frontend code'),
  ]);
});
