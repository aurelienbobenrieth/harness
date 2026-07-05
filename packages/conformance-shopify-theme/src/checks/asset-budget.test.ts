import { expect, it } from "vitest";
import { assetBudget } from "./asset-budget.js";
import { createFixture } from "./test-support.js";

it("passes for assets under budget", async () => {
  const root = await createFixture({ "assets/cart.js": "console.log('tiny');" });
  expect(await assetBudget.run({ root })).toEqual([]);
});

it("reports assets over budget", async () => {
  const root = await createFixture({ "assets/cart.js": "x".repeat(100) });
  const findings = await assetBudget.run({
    root,
    assetBudgets: [{ pattern: "*.js", maxBytes: 50 }],
  });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("over the 50 byte budget")]);
});

it("applies the most specific matching budget", async () => {
  const root = await createFixture({ "assets/critical.css": "x".repeat(100) });
  const findings = await assetBudget.run({
    root,
    assetBudgets: [
      { pattern: "*.css", maxBytes: 1000 },
      { pattern: "critical*.css", maxBytes: 50 },
    ],
  });
  expect(findings).toHaveLength(1);
});
