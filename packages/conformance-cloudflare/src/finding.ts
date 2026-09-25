export type ConformanceSeverity = "error" | "warning";

/** One observation from a check: a violation, advice, or a gap in the evidence. */
export interface ConformanceFinding {
  readonly check: string;
  readonly message: string;
  readonly severity: ConformanceSeverity;
  /** Set when evidence is missing: the input or tool is unsupported, or reading it failed. */
  readonly evaluation?: "unsupported" | "failed";
  /** Project-relative file the finding is about. */
  readonly path?: string;
  /** Cloudflare documentation that justifies the finding. */
  readonly docs: string;
}

export interface ConformanceCheck {
  readonly id: string;
  readonly docs: string;
  readonly description: string;
  readonly run: (options: ConformanceRunOptions) => Promise<readonly ConformanceFinding[]>;
}

/** Coverage of one check. `evaluated` means it ran to completion; its findings can still hold violations. */
export interface ConformanceEvaluation {
  readonly check: string;
  readonly findings: readonly ConformanceFinding[];
  readonly status: "evaluated" | "skipped" | "unsupported" | "failed";
  readonly reason?: string;
}

/** `passed` only when every check was evaluated and none reported an error. */
export interface ConformanceReport {
  readonly findings: readonly ConformanceFinding[];
  readonly checks: readonly ConformanceEvaluation[];
  readonly status: "passed" | "incomplete" | "failed";
}

export type WranglerTypesOptions = {
  /** Extra arguments appended after `types --check`, e.g. a custom output path or `--env-interface`. */
  readonly args?: readonly string[];
  /** Hard limit for one `wrangler types --check` run. Default: 120000. */
  readonly timeoutMs?: number;
};

export type ConformanceRunOptions = {
  readonly root: string;
  /**
   * Project-relative Wrangler configuration files, one per Worker. Unset: the first of `wrangler.json`,
   * `wrangler.jsonc`, `wrangler.toml` at the root, in Wrangler's own lookup order.
   */
  readonly wranglerConfigs?: readonly string[];
  /** Check ids to exclude; they are reported as skipped, never as passed. */
  readonly skipChecks?: readonly string[];
  /** Clock for `compatibility-date-current`. Default: the system clock. */
  readonly now?: Date | string;
  /** Oldest accepted `compatibility_date`, in days before `now`. Default: 180. */
  readonly compatibilityDateMaxAgeDays?: number;
  /** `vars` names reviewed as non-secret despite a secret-looking name. Values are still scanned. */
  readonly allowedVars?: readonly string[];
  readonly wranglerTypes?: WranglerTypesOptions;
};
