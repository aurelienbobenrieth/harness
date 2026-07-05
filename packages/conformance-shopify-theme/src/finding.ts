export type ConformanceSeverity = "error" | "warning";

export type ConformanceFinding = {
  readonly check: string;
  readonly severity: ConformanceSeverity;
  readonly message: string;
  readonly path?: string;
  readonly docs: string;
};

export type ConformanceCheck = {
  readonly id: string;
  readonly description: string;
  readonly docs: string;
  readonly run: (options: ConformanceRunOptions) => Promise<readonly ConformanceFinding[]>;
};

export type AssetBudget = {
  /** Glob-like filename pattern relative to assets/, `*` matches within one segment. */
  readonly pattern: string;
  readonly maxBytes: number;
};

export type ConformanceRunOptions = {
  readonly root: string;
  /** Markers that prove a platform injects the App Bridge script at serve time. */
  readonly platformMarkers?: readonly string[];
  /** Path to the primitive registry JSON, relative to root. Default: registry.json */
  readonly registryPath?: string;
  /** Path to the machine-readable event contract, relative to root. Default: frontend/features/storefront-events/events.json */
  readonly eventsPath?: string;
  /** Design token custom property prefixes. Default: ["--theme-", "--scheme-"] */
  readonly tokenPrefixes?: readonly string[];
  /** Per-asset size budgets. Default: 32 KB per JS asset, 200 KB per CSS asset. */
  readonly assetBudgets?: readonly AssetBudget[];
  /** Maximum settings per merchant block before grouping is mandatory. Default: 25 */
  readonly settingsBudget?: number;
  /** Minimum WCAG contrast ratio for scheme text/background pairs. Default: 4.5 */
  readonly contrastMinRatio?: number;
  /** Templates every publishable theme must ship. Default: Shopify required template set. */
  readonly requiredTemplates?: readonly string[];
  /** Allowed utility class names or patterns for custom_classes settings. Unset: check skipped. */
  readonly utilityClasses?: readonly string[];
  /** Check ids to skip, e.g. registry-sync for themes without a primitive registry. */
  readonly skipChecks?: readonly string[];
};
