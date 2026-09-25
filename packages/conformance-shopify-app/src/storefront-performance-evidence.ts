/** Mobile Lighthouse scores on the same store, theme, runner and representative pages. Scores use 0–100. */
export type ShopifyStorefrontRun = {
  readonly store: string;
  readonly theme: string;
  readonly runner: string;
  readonly device: "mobile";
  /** Inspectable artifact reference; keep storefront preview credentials out of committed records. */
  readonly reference: string;
  readonly pages: {
    readonly home: readonly number[];
    readonly product: readonly number[];
    readonly collection: readonly number[];
  };
};

export type ShopifyStorefrontPerformanceResult = {
  readonly status: "passed" | "failed" | "incomplete";
  /** Baseline minus installed weighted score. A negative value means the supplied runs improved. */
  readonly reduction?: number;
  readonly message: string;
};

const weights = { home: 17, product: 40, collection: 43 } as const;
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validRun(value: unknown): value is ShopifyStorefrontRun {
  if (!object(value) || value.device !== "mobile" || !object(value.pages)) return false;
  if (
    !["store", "theme", "runner", "reference"].every(
      (key) => typeof value[key] === "string" && String(value[key]).trim(),
    )
  )
    return false;
  const pages = value.pages;
  return (
    Object.keys(pages).length === 3 &&
    Object.keys(weights).every((key) => {
      const scores = pages[key];
      return (
        Array.isArray(scores) &&
        scores.length > 0 &&
        Array.from(scores).every(
          (score) => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100,
        )
      );
    })
  );
}
function weighted(run: ShopifyStorefrontRun): number {
  return (
    Object.entries(weights).reduce((sum, [key, weight]) => {
      const scores = run.pages[key as keyof typeof weights];
      return sum + (scores.reduce((total, score) => total + score, 0) / scores.length) * weight;
    }, 0) / 100
  );
}

/**
 * Compares supplied before/after runs using Shopify's page weights and ten-point budget.
 * Does not run Lighthouse or verify provenance, representative configuration, or live eligibility.
 * @attribution https://shopify.dev/docs/apps/build/performance/storefront (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently implemented)
 */
export function evaluateShopifyStorefrontPerformance(evidence: unknown): ShopifyStorefrontPerformanceResult {
  if (!object(evidence) || !validRun(evidence.baseline) || !validRun(evidence.installed))
    return {
      status: "incomplete",
      message:
        "Supply mobile before/after runs with nonempty 0–100 score arrays for home, product and collection pages, plus environment and artifact references.",
    };
  const { baseline, installed } = evidence;
  if (
    baseline.store !== installed.store ||
    baseline.theme !== installed.theme ||
    baseline.runner !== installed.runner ||
    baseline.reference === installed.reference
  )
    return {
      status: "incomplete",
      message: "Use the same store, theme and runner configuration with distinct before/after evidence references.",
    };
  const baselineScore = weighted(baseline);
  const installedScore = weighted(installed);
  const reduction = baselineScore - installedScore;
  // Decimal scores accumulate binary roundoff through averaging and weighting.
  const roundoff = Number.EPSILON * Math.max(1, baselineScore, installedScore) * 16;
  return {
    status: reduction - 10 > roundoff ? "failed" : "passed",
    reduction,
    message:
      "Compared supplied mobile page scores using 17/40/43 weights and a ten-point reduction budget. Verify matching pages, app configuration and provenance separately.",
  };
}
