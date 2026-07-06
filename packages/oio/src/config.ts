export type OioBudget = {
  /** Filename pattern relative to assets/, `*` matches within one segment. */
  readonly pattern: string;
  readonly maxBytes: number;
};

export type OioRegistryConfig = {
  /** Human-facing registry table. Default: docs/theme-os/primitive-registry.md */
  readonly markdownPath?: string;
  /** Machine registry. Default: registry.json */
  readonly jsonPath?: string;
  /** Allowed status values. Default: implemented, refactor, skeleton, direct-plus, proposed, rejected */
  readonly statuses?: readonly string[];
  /** Minimum number of registry entries. Default: 0 */
  readonly minCount?: number;
};

export type OioDocsConfig = {
  /** Output directory for generated docs, relative to root. Default: docs/generated */
  readonly outputDir?: string;
  /** Machine-readable event contract to document. */
  readonly eventsPath?: string;
};

export type OioConfig = {
  readonly registry?: OioRegistryConfig;
  readonly budgets?: readonly OioBudget[];
  readonly docs?: OioDocsConfig;
  /** Namespace for scaffolded machines and custom elements. Default: oio */
  readonly namespace?: string;
};

export function defineConfig(config: OioConfig): OioConfig {
  return config;
}

export const defaultStatuses = ["implemented", "refactor", "skeleton", "direct-plus", "proposed", "rejected"] as const;

export const defaultBudgets: readonly OioBudget[] = [
  { pattern: "*.js", maxBytes: 32_000 },
  { pattern: "*.css", maxBytes: 200_000 },
  { pattern: "critical*.css", maxBytes: 14_000 },
];
