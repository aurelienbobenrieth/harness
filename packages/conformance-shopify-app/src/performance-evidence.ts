/**
 * Compares supplied measurements with the reviewed Shopify thresholds. This does
 * not collect telemetry, authenticate its provenance, or award platform status.
 * @attribution https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently implemented)
 */
export const shopifyPerformanceCriteria = {
  "admin-lcp": {
    requirement: "2.1.1",
    unit: "ms",
    statistic: "p75",
    limit: 2500,
    comparison: "at-most",
    minimumSamples: 100,
  },
  "admin-cls": {
    requirement: "2.1.2",
    unit: "score",
    statistic: "p75",
    limit: 0.1,
    comparison: "at-most",
    minimumSamples: 100,
  },
  "admin-inp": {
    requirement: "2.1.3",
    unit: "ms",
    statistic: "p75",
    limit: 200,
    comparison: "at-most",
    minimumSamples: 100,
  },
  "checkout-carrier-latency": {
    requirement: "2.3.1",
    unit: "ms",
    statistic: "p95",
    limit: 500,
    comparison: "at-most",
    minimumSamples: 1000,
  },
  "carrier-latency": {
    requirement: "5.4.1",
    unit: "ms",
    statistic: "p95",
    limit: 500,
    comparison: "below",
    minimumSamples: 1000,
  },
  "checkout-carrier-failure": {
    requirement: "2.3.1",
    unit: "percent",
    statistic: "ratio",
    limit: 0.1,
    comparison: "at-most",
    minimumSamples: 1000,
  },
  "carrier-success": {
    requirement: "5.4.2",
    unit: "percent",
    statistic: "ratio",
    limit: 99.9,
    comparison: "at-least",
    minimumSamples: 1000,
  },
  "fulfillment-volume": {
    requirement: "5.8.1",
    unit: "count",
    statistic: "count",
    limit: 100,
    comparison: "at-least",
    minimumSamples: 0,
  },
  "fulfillment-completion": {
    requirement: "5.8.2",
    unit: "percent",
    statistic: "ratio",
    limit: 97,
    comparison: "at-least",
    minimumSamples: 1,
  },
  "fulfillment-callback-success": {
    requirement: "5.8.3",
    unit: "percent",
    statistic: "ratio",
    limit: 99,
    comparison: "at-least",
    minimumSamples: 1,
  },
  "fulfillment-tracking": {
    requirement: "5.8.5",
    unit: "percent",
    statistic: "ratio",
    limit: 80,
    comparison: "at-least",
    minimumSamples: 1,
  },
  "fulfillment-response": {
    requirement: "5.8.6",
    unit: "percent",
    statistic: "ratio",
    limit: 95,
    comparison: "at-least",
    minimumSamples: 1,
  },
  "cancellation-response": {
    requirement: "5.8.7",
    unit: "percent",
    statistic: "ratio",
    limit: 99,
    comparison: "at-least",
    minimumSamples: 1,
  },
} as const;

export type ShopifyPerformanceMetric = keyof typeof shopifyPerformanceCriteria;

/** One aggregate from the complete stated population, not a best-case test run. */
export type ShopifyPerformanceMeasurement = {
  readonly metric: ShopifyPerformanceMetric;
  readonly value: number;
  readonly samples: number;
  /** Required for ratios: numerator over samples. For carrier failure this counts failures. */
  readonly qualifyingSamples?: number;
  readonly unit: "ms" | "score" | "percent" | "count";
  readonly statistic: "p75" | "p95" | "ratio" | "count";
  /** UTC instants delimiting the preceding 28 days. */
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly appId: string;
  /** An inspectable dashboard/export/log reference; never a token or customer identifier. */
  readonly reference: string;
  readonly source: "shopify-dashboard" | "observability";
  /** Required for fulfillment-completion: exclude orders created in the most recent seven days. */
  readonly excludedRecentDays?: number;
  /** Required for tracking (one hour), fulfillment/cancellation responses (24 hours). */
  readonly withinHours?: number;
};

export type ShopifyPerformanceResult = {
  readonly metric: ShopifyPerformanceMetric;
  readonly requirement: string;
  readonly status: "passed" | "failed" | "incomplete";
  readonly message: string;
};

export type ShopifyPerformanceReport = {
  /** Passing means only that supplied evidence matches these numeric contracts. */
  readonly status: "passed" | "failed" | "incomplete";
  readonly results: readonly ShopifyPerformanceResult[];
};

const dayMs = 86_400_000;

function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : Number.NaN;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fails closed on missing, duplicate, stale, invalid or mismatched evidence.
 * `maxAgeDays` is a caller's freshness policy (default one day), not a Shopify rule.
 * Select applicable metrics explicitly; empty or unknown selections are errors.
 */
export function evaluateShopifyPerformance(
  evidence: unknown,
  options: {
    readonly required: readonly ShopifyPerformanceMetric[];
    readonly appId: string;
    readonly now: string;
    readonly maxAgeDays?: number;
  },
): ShopifyPerformanceReport {
  const now = instant(options.now);
  const maxAgeDays = options.maxAgeDays ?? 1;
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeDays) || maxAgeDays < 0 || !options.appId.trim())
    throw new TypeError("Provide a valid UTC now, appId and nonnegative freshness policy.");
  if (
    !Array.isArray(options.required) ||
    options.required.length === 0 ||
    new Set(options.required).size !== options.required.length ||
    Array.from(options.required).some((id) => typeof id !== "string" || !Object.hasOwn(shopifyPerformanceCriteria, id))
  )
    throw new TypeError("Select at least one distinct, known Shopify performance metric.");
  if (
    !Array.isArray(evidence) ||
    Array.from(evidence).some(
      (entry) =>
        !record(entry) || typeof entry.metric !== "string" || !Object.hasOwn(shopifyPerformanceCriteria, entry.metric),
    )
  )
    throw new TypeError("Evidence must be an array of records with known metric identifiers.");

  const results = options.required.map((metric: ShopifyPerformanceMetric): ShopifyPerformanceResult => {
    const criterion = shopifyPerformanceCriteria[metric];
    const base = { metric, requirement: `bfs/${criterion.requirement}` };
    const entries = evidence.filter((entry: Record<string, unknown>) => entry.metric === metric);
    const incomplete = (message: string): ShopifyPerformanceResult => ({
      ...base,
      status: "incomplete",
      message,
    });
    if (entries.length !== 1) return incomplete("Supply exactly one measurement for this metric.");
    const entry = entries[0] as Record<string, unknown>;
    const start = instant(entry.windowStart);
    const end = instant(entry.windowEnd);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end - start !== 28 * dayMs ||
      end > now ||
      now - end > maxAgeDays * dayMs
    )
      return incomplete("Supply a fresh, complete 28-day UTC measurement window ending at or before now.");
    if (
      entry.appId !== options.appId ||
      typeof entry.reference !== "string" ||
      !entry.reference.trim() ||
      typeof entry.source !== "string" ||
      !["shopify-dashboard", "observability"].includes(entry.source)
    )
      return incomplete("Supply matching app identity and an inspectable measurement source.");
    if (entry.unit !== criterion.unit || entry.statistic !== criterion.statistic)
      return incomplete("Match the metric's required unit and statistic.");
    if (
      typeof entry.value !== "number" ||
      !Number.isFinite(entry.value) ||
      entry.value < 0 ||
      (criterion.unit === "percent" && entry.value > 100) ||
      (criterion.unit === "count" && !Number.isSafeInteger(entry.value))
    )
      return incomplete("Supply a finite measurement in the metric's valid range.");
    if (
      typeof entry.samples !== "number" ||
      !Number.isSafeInteger(entry.samples) ||
      entry.samples < criterion.minimumSamples ||
      (criterion.unit === "count" && entry.samples !== entry.value)
    )
      return incomplete("Supply the required population count; counts and measured volume must agree.");
    let measured = entry.value;
    if (criterion.statistic === "ratio") {
      if (
        typeof entry.qualifyingSamples !== "number" ||
        !Number.isSafeInteger(entry.qualifyingSamples) ||
        entry.qualifyingSamples < 0 ||
        entry.qualifyingSamples > entry.samples
      )
        return incomplete("Supply an integer ratio numerator between zero and the population count.");
      measured = (entry.qualifyingSamples * 100) / entry.samples;
      if (Math.abs(measured - entry.value) > 1e-9)
        return incomplete(
          "The percentage must agree with the supplied numerator and denominator; do not round it before evaluation.",
        );
    }
    if (metric === "fulfillment-completion" && entry.excludedRecentDays !== 7)
      return incomplete("Exclude orders created in the most recent seven days from the completion population.");
    const hours =
      metric === "fulfillment-tracking"
        ? 1
        : ["fulfillment-response", "cancellation-response"].includes(metric)
          ? 24
          : undefined;
    if (hours !== undefined && entry.withinHours !== hours)
      return incomplete(`Measure the fraction completed within ${hours} hours.`);
    const passed =
      criterion.comparison === "below"
        ? measured < criterion.limit
        : criterion.comparison === "at-most"
          ? measured <= criterion.limit
          : measured >= criterion.limit;
    return {
      ...base,
      status: passed ? "passed" : "failed",
      message: `${measured} ${criterion.unit}; required ${criterion.comparison} ${criterion.limit}. Supplied evidence only.`,
    };
  });
  return {
    status: results.some((entry) => entry.status === "failed")
      ? "failed"
      : results.some((entry) => entry.status === "incomplete")
        ? "incomplete"
        : "passed",
    results,
  };
}
