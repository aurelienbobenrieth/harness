import { expect, it } from "vitest";
import {
  evaluateShopifyPerformance,
  shopifyPerformanceCriteria,
  type ShopifyPerformanceMeasurement,
  type ShopifyPerformanceMetric,
} from "./performance-evidence.js";

const options = {
  required: ["admin-lcp", "admin-cls", "admin-inp"] as const,
  appId: "app-under-review",
  now: "2026-09-05T00:00:00.000Z",
};
function measurement(metric: ShopifyPerformanceMetric): ShopifyPerformanceMeasurement {
  const criterion = shopifyPerformanceCriteria[metric];
  return {
    metric,
    value: criterion.comparison === "below" ? criterion.limit - 1 : criterion.limit,
    samples:
      criterion.statistic === "ratio"
        ? 1000
        : Math.max(criterion.minimumSamples, criterion.unit === "count" ? criterion.limit : 1),
    qualifyingSamples: criterion.statistic === "ratio" ? criterion.limit * 10 : undefined,
    unit: criterion.unit,
    statistic: criterion.statistic,
    windowStart: "2026-08-08T00:00:00.000Z",
    windowEnd: options.now,
    appId: options.appId,
    source: "shopify-dashboard",
    reference: "artifacts/performance-export.json",
    excludedRecentDays: 7,
    withinHours: metric === "fulfillment-tracking" ? 1 : 24,
  };
}

it("accepts exact admin boundaries and rejects each exceeded budget", () => {
  const evidence = options.required.map(measurement);
  expect(evaluateShopifyPerformance(evidence, options).status).toBe("passed");
  expect(
    evaluateShopifyPerformance(
      evidence.map((entry) => ({ ...entry, value: entry.value + 0.01 })),
      options,
    ).results.map((entry) => entry.status),
  ).toEqual(["failed", "failed", "failed"]);
});

it("keeps missing and under-sampled metrics incomplete", () => {
  expect(evaluateShopifyPerformance([], options).status).toBe("incomplete");
  expect(
    evaluateShopifyPerformance(
      options.required.map((metric) => ({ ...measurement(metric), samples: 99 })),
      options,
    ).results.every((entry) => entry.status === "incomplete"),
  ).toBe(true);
});

it("preserves the different carrier latency boundaries in the official requirements", () => {
  const required = ["checkout-carrier-latency", "carrier-latency", "carrier-success"] as const;
  const evidence = required.map((metric) => ({
    ...measurement(metric),
    value: metric === "carrier-success" ? 99.9 : 500,
  }));
  expect(evaluateShopifyPerformance(evidence, { ...options, required }).results.map((entry) => entry.status)).toEqual([
    "passed",
    "failed",
    "passed",
  ]);
  expect(
    evaluateShopifyPerformance(
      evidence.map((entry) => ({ ...entry, samples: 999 })),
      { ...options, required },
    ).status,
  ).toBe("incomplete");
});

it.each([
  { value: Number.NaN },
  { value: Infinity },
  { value: -1 },
  { samples: 100.5 },
  { samples: -1 },
  { unit: "seconds" },
  { statistic: "mean" },
  { appId: "another-app" },
  { reference: " " },
  { source: "lighthouse" },
  { source: ["observability"] },
  { source: null },
  { source: 1 },
  { windowEnd: "2026-09-06T00:00:00.000Z", windowStart: "2026-08-09T00:00:00.000Z" },
  { windowEnd: "2026-09-03T00:00:00.000Z", windowStart: "2026-08-06T00:00:00.000Z" },
  { windowStart: "2026-08-09T00:00:00.000Z" },
  { windowStart: "2026-02-30T00:00:00.000Z" },
])("rejects invalid evidence as incomplete: %j", (patch) => {
  expect(
    evaluateShopifyPerformance([{ ...measurement("admin-lcp"), ...patch }], {
      ...options,
      required: ["admin-lcp"],
    }).status,
  ).toBe("incomplete");
});

it("rejects duplicate and mismatched metadata instead of selecting a convenient measurement", () => {
  expect(
    evaluateShopifyPerformance([measurement("admin-lcp"), measurement("admin-lcp")], {
      ...options,
      required: ["admin-lcp"],
    }).status,
  ).toBe("incomplete");
  expect(() => evaluateShopifyPerformance([{ ...measurement("admin-lcp"), metric: "typo" }], options)).toThrow(
    "known metric",
  );
  expect(() => evaluateShopifyPerformance(null, options)).toThrow("array");
  expect(() => evaluateShopifyPerformance([], { ...options, required: [] })).toThrow("at least one");
  expect(() => evaluateShopifyPerformance([], { ...options, required: ["admin-lcp", "admin-lcp"] })).toThrow(
    "distinct",
  );
  expect(() => evaluateShopifyPerformance([], { ...options, maxAgeDays: -1 })).toThrow("freshness");
  expect(() => evaluateShopifyPerformance([], { ...options, now: "2026-02-30T00:00:00.000Z" })).toThrow("UTC");
});

it("rejects sparse selections and malformed extra evidence instead of granting a partial pass", () => {
  const required: ShopifyPerformanceMetric[] = [];
  required.length = 1;
  expect(() => evaluateShopifyPerformance([], { ...options, required })).toThrow("known");
  const sparse: unknown[] = [];
  sparse.length = 1;
  expect(() => evaluateShopifyPerformance(sparse, options)).toThrow("known metric");
  expect(() =>
    evaluateShopifyPerformance([measurement("admin-lcp"), { ...measurement("admin-lcp"), metric: ["admin-lcp"] }], {
      ...options,
      required: ["admin-lcp"],
    }),
  ).toThrow("known metric");
});

it("requires the fulfillment denominator and response-time semantics", () => {
  const required = Object.keys(shopifyPerformanceCriteria).filter(
    (metric) => metric.startsWith("fulfillment-") || metric === "cancellation-response",
  ) as ShopifyPerformanceMetric[];
  expect(evaluateShopifyPerformance(required.map(measurement), { ...options, required }).status).toBe("passed");
  const broken = required.map((metric) => ({
    ...measurement(metric),
    excludedRecentDays: 0,
    withinHours: 48,
    ...(metric === "fulfillment-callback-success" ? { samples: 0 } : {}),
  }));
  expect(evaluateShopifyPerformance(broken, { ...options, required }).results.map((entry) => entry.status)).toEqual([
    "passed",
    "incomplete",
    "incomplete",
    "incomplete",
    "incomplete",
    "incomplete",
  ]);
});

it("distinguishes insufficient traffic, impossible ratios, and measured failure", () => {
  expect(
    evaluateShopifyPerformance([{ ...measurement("carrier-success"), value: 100.01 }], {
      ...options,
      required: ["carrier-success"],
    }).status,
  ).toBe("incomplete");
  expect(
    evaluateShopifyPerformance([{ ...measurement("carrier-success"), value: 99.8, qualifyingSamples: 998 }], {
      ...options,
      required: ["carrier-success"],
    }).status,
  ).toBe("failed");
  expect(
    evaluateShopifyPerformance([{ ...measurement("fulfillment-volume"), value: 99, samples: 99 }], {
      ...options,
      required: ["fulfillment-volume"],
    }).status,
  ).toBe("failed");
  expect(
    evaluateShopifyPerformance([{ ...measurement("fulfillment-volume"), samples: 99 }], {
      ...options,
      required: ["fulfillment-volume"],
    }).status,
  ).toBe("incomplete");
});

it("allows an explicit freshness policy while keeping future and malformed dates invalid", () => {
  const old = {
    ...measurement("admin-lcp"),
    windowEnd: "2026-09-03T00:00:00.000Z",
    windowStart: "2026-08-06T00:00:00.000Z",
  };
  expect(evaluateShopifyPerformance([old], { ...options, required: ["admin-lcp"], maxAgeDays: 2 }).status).toBe(
    "passed",
  );
});

it("rejects impossible ratios and compares the derived percentage at the exact failure boundary", () => {
  const required = ["checkout-carrier-failure"] as const;
  expect(evaluateShopifyPerformance([measurement("checkout-carrier-failure")], { ...options, required }).status).toBe(
    "passed",
  );
  expect(
    evaluateShopifyPerformance([{ ...measurement("checkout-carrier-failure"), value: 0.2, qualifyingSamples: 2 }], {
      ...options,
      required,
    }).status,
  ).toBe("failed");
  expect(
    evaluateShopifyPerformance([{ ...measurement("fulfillment-completion"), samples: 1, qualifyingSamples: 1 }], {
      ...options,
      required: ["fulfillment-completion"],
    }).status,
  ).toBe("incomplete");
  for (const qualifyingSamples of [undefined, -1, 1001, 999.5, Number.NaN]) {
    expect(
      evaluateShopifyPerformance([{ ...measurement("carrier-success"), qualifyingSamples }], {
        ...options,
        required: ["carrier-success"],
      }).status,
    ).toBe("incomplete");
  }
});
