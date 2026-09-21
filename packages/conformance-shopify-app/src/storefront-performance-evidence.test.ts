import { expect, it } from "vitest";
import { evaluateShopifyStorefrontPerformance, type ShopifyStorefrontRun } from "./storefront-performance-evidence.js";

const run = (score: number, reference: string): ShopifyStorefrontRun => ({
  store: "fixture",
  theme: "theme-revision",
  runner: "lighthouse-version-and-settings",
  device: "mobile",
  reference,
  pages: { home: [score], product: [score], collection: [score] },
});
it("accepts the exact ten-point boundary and rejects a greater reduction", () => {
  expect(
    evaluateShopifyStorefrontPerformance({
      baseline: run(95, "before"),
      installed: run(85, "after"),
    }),
  ).toMatchObject({ status: "passed", reduction: 10 });
  expect(
    evaluateShopifyStorefrontPerformance({
      baseline: run(95, "before"),
      installed: run(84.9, "after"),
    }).status,
  ).toBe("failed");
  expect(
    evaluateShopifyStorefrontPerformance({
      baseline: run(90, "before"),
      installed: run(95, "after"),
    }),
  ).toMatchObject({ status: "passed", reduction: -5 });
});
it("weights all three page types after averaging each page's repeated runs", () => {
  const installed = {
    ...run(100, "after"),
    pages: { home: [20, 40], product: [100], collection: [100] },
  };
  const result = evaluateShopifyStorefrontPerformance({ baseline: run(100, "before"), installed });
  expect(result.reduction).toBeCloseTo(11.9);
  expect(result.status).toBe("failed");
});
it("preserves the fractional ten-point boundary without hiding a measurable excess", () => {
  expect(
    evaluateShopifyStorefrontPerformance({
      baseline: run(16.1, "before"),
      installed: run(6.1, "after"),
    }).status,
  ).toBe("passed");
  expect(
    evaluateShopifyStorefrontPerformance({
      baseline: run(16.100000001, "before"),
      installed: run(6.1, "after"),
    }).status,
  ).toBe("failed");
});
const pages = (scores: number[]): ShopifyStorefrontRun["pages"] => ({
  home: scores,
  product: scores,
  collection: scores,
});
it("preserves the exact boundary when repeated integer runs produce fractional means", () => {
  expect(
    evaluateShopifyStorefrontPerformance({
      baseline: { ...run(0, "before"), pages: pages([50, 72, 72]) },
      installed: { ...run(0, "after"), pages: pages([40, 62, 62]) },
    }).status,
  ).toBe("passed");
});
it.each([
  undefined,
  {},
  { baseline: run(90, "before") },
  { baseline: run(90, "before"), installed: run(90, "before") },
])("keeps missing or reused evidence incomplete", (evidence) => {
  expect(evaluateShopifyStorefrontPerformance(evidence).status).toBe("incomplete");
});
it.each([{ store: "another" }, { theme: "another" }, { runner: "another" }, { device: "desktop" }, { reference: " " }])(
  "rejects incomparable environments: %j",
  (patch) => {
    expect(
      evaluateShopifyStorefrontPerformance({
        baseline: run(90, "before"),
        installed: { ...run(90, "after"), ...patch },
      }).status,
    ).toBe("incomplete");
  },
);
it.each([[], [Number.NaN], [Infinity], [-1], [101], Array.from({ length: 2 })])(
  "rejects absent or impossible page scores",
  (scores) => {
    expect(
      evaluateShopifyStorefrontPerformance({
        baseline: run(90, "before"),
        installed: {
          ...run(90, "after"),
          pages: { home: scores, product: [90], collection: [90] },
        },
      }).status,
    ).toBe("incomplete");
  },
);
it("rejects omitted pages instead of changing weights", () => {
  expect(
    evaluateShopifyStorefrontPerformance({
      baseline: run(90, "before"),
      installed: { ...run(90, "after"), pages: { home: [90], product: [90] } },
    }).status,
  ).toBe("incomplete");
});
