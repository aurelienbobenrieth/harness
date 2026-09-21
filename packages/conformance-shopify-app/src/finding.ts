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

export type ConformanceRunOptions = {
  readonly root: string;
  /** One project-relative shopify.app[.environment].toml to evaluate. Unset: inspect all root app manifests. */
  readonly appManifest?: string;
  /** Markers that prove a platform injects the App Bridge script at serve time. */
  readonly platformMarkers?: readonly string[];
  /**
   * Bundle budget for UI extensions in kilobytes. Defaults to Shopify's hard
   * 64 KB deployment limit; set a lower number to enforce a stricter budget.
   */
  readonly checkoutBundleLimitKb?: number;
  /** Explicit reviewed API version bounds; no support deadline is guessed from the system clock. */
  readonly minimumApiVersion?: string;
  readonly maximumApiVersion?: string;
  /**
   * Project-relative paths or glob patterns of modules that configure the Shopify app server. Unset:
   * `shopify.server.*` at the root, in `app/`, and in `src/`. Their literal `apiVersion` is checked
   * against the version bounds and compared with `[webhooks] api_version`.
   */
  readonly serverEntries?: readonly string[];
  /** Explicit application categories for partial Built for Shopify extension prerequisites. */
  readonly builtForShopifyCategories?: readonly BuiltForShopifyCategory[];
  /** Project-relative document entries; unset discovers common HTML and JSX root layouts. */
  readonly documentEntries?: readonly string[];
  /** Validate only explicitly supplied listing metadata and asset files; omitted fields are not assessed. */
  readonly listing?: import("./checks/listing-inputs.js").ShopifyAppListing;
};

export type BuiltForShopifyCategory =
  | "advertising"
  | "email-marketing"
  | "forms"
  | "sms-marketing"
  | "invoices"
  | "product-reviews"
  | "subscriptions";
