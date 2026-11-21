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
  /** Opt-in: Admin API paths in source must use the app's API version. Unset: source is not scanned. */
  readonly adminApiPaths?: AdminApiPaths;
  /**
   * How tightly an App Home document's Polaris CDN script follows `@shopify/polaris-types`. `"major"` (default):
   * same major, so `polaris-2.js` follows Shopify's releases. `"minor"`: the script names the types' minor, for
   * example `polaris-2.0.js` with types 2.0.x, so a Polaris release reaches merchants only with a types bump.
   */
  readonly polarisCdnPin?: "major" | "minor";
  /** Opt-in: the project folder of the `shopify-pattern` skill attaches every custom component to a catalogued entry. */
  readonly shopifyPattern?: ShopifyPatternFolders;
  /** Explicit application categories for partial Built for Shopify extension prerequisites. */
  readonly builtForShopifyCategories?: readonly BuiltForShopifyCategory[];
  /** Project-relative document entries; unset discovers common HTML and JSX root layouts. */
  readonly documentEntries?: readonly string[];
  /**
   * Also validate the `[events]` block (Next Generation Events). Default `false`: Events is a developer
   * preview on the `unstable` API version, so its configuration contract can still change.
   */
  readonly nextGenerationEvents?: boolean;
  /**
   * How the app is distributed. `compliance-webhooks` applies to `"public"` (App Store) apps only: custom
   * apps are not required to subscribe to the privacy compliance topics. Default `"public"`.
   */
  readonly distribution?: "public" | "custom";
  /** Validate only explicitly supplied listing metadata and asset files; omitted fields are not assessed. */
  readonly listing?: import("./checks/listing-inputs.js").ShopifyAppListing;
};

export type AdminApiPaths = {
  /**
   * Project-relative paths or glob patterns of the modules that build Admin API URLs. Each must match a script
   * file; `*.test.*` and `*.spec.*` files are skipped. Every `/admin/api/<segment>/` in them must name the app's
   * `[webhooks] api_version`, and at least one must exist.
   */
  readonly sources: readonly string[];
  /**
   * The identifier that holds the version, for example `adminApiVersion`. Set: a path may write `${adminApiVersion}`
   * instead of the literal version, and the sources must declare the constant with the app's version as a literal.
   */
  readonly constant?: string;
};

export type ShopifyPatternFolders = {
  /** Project-relative folder of the installed skill. Default `.agents/skills/shopify-pattern`. */
  readonly skill?: string;
  /** Project-relative project folder holding `components.md`, for example `.agents/shopify-pattern`. */
  readonly project: string;
  /** Project-relative folder whose every direct child is a custom component that reproduces a catalogued entry. */
  readonly components: string;
};

export type BuiltForShopifyCategory =
  | "advertising"
  | "email-marketing"
  | "forms"
  | "sms-marketing"
  | "invoices"
  | "product-reviews"
  | "returns"
  | "subscriptions";
