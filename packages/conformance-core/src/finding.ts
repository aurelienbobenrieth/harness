export type ConformanceSeverity = "error" | "warning";

export type ConformanceFinding = {
  readonly check: string;
  readonly severity: ConformanceSeverity;
  readonly message: string;
  readonly path?: string;
  readonly docs: string;
  /** Evidence unavailable because input/tool support is absent or execution failed. */
  readonly evaluation?: "unsupported" | "failed";
};

export type ConformanceCheck = {
  readonly id: string;
  readonly description: string;
  readonly docs: string;
  readonly run: (options: ConformanceRunOptions) => Promise<readonly ConformanceFinding[]>;
};

export type ConformanceEvaluation = {
  readonly check: string;
  /** Evaluated describes execution coverage; findings can still contain violations. */
  readonly status: "evaluated" | "skipped" | "unsupported" | "failed";
  readonly reason?: string;
  readonly findings: readonly ConformanceFinding[];
};

export type ConformanceReport = {
  /** Incomplete evidence never produces a passed report. */
  readonly status: "passed" | "incomplete" | "failed";
  readonly checks: readonly ConformanceEvaluation[];
  readonly findings: readonly ConformanceFinding[];
};

export type DuplicationOptions = {
  /** Fail when jscpd is unavailable, times out, or returns an invalid report. Default: false. */
  readonly requireTool?: boolean;
  /** Additional generated/vendor glob exclusions passed to jscpd. */
  readonly ignorePatterns?: readonly string[];
  /** Minimum clone size in lines before jscpd reports it. Default: 8 */
  readonly minLines?: number;
  /** Minimum clone size in tokens before jscpd reports it. Default: 60 */
  readonly minTokens?: number;
  /** Number of clones tolerated before the check fails. Default: 0 */
  readonly maxClones?: number;
};

export type DeadExportsOptions = {
  /** When true, a missing knip config is reported even if knip itself is not installed. Default: false */
  readonly requireKnipConfig?: boolean;
};

export type ClosedDesignSystemOptions = {
  /** Entry stylesheet passed to the build, relative to root. */
  readonly stylesheet: string;
  /**
   * Build command producing the final CSS. `{stylesheet}` and `{output}` placeholders are
   * substituted with absolute paths. Supply a native executable or node and an installed tool entrypoint; there is no default.
   */
  readonly buildCommand?: readonly string[];
  /** Exact selectors that must appear in the built CSS. */
  readonly requiredSelectors: readonly string[];
  /** Exact selectors that must not appear in the built CSS. This is a finite probe. */
  readonly forbiddenSelectors: readonly string[];
};

export type TsconfigStrictnessOptions = {
  /**
   * Root-relative tsconfig files to check. Default: `tsconfig.json` and `tsconfig.*.json` in the root and in
   * every pnpm workspace package, minus configs that only serve as an `extends` base of another checked config.
   */
  readonly files?: readonly string[];
  /** Compiler flags that must also resolve to `true`, e.g. `noImplicitOverride`. */
  readonly additionalRequiredFlags?: readonly string[];
  /**
   * Flag name to written reason. A waived flag is reported as a warning instead of an error.
   * Reasons shorter than three words are rejected, and so are waivers for flags the check does not own.
   */
  readonly waivers?: Readonly<Record<string, string>>;
};

export type ConformanceRunOptions = {
  readonly root: string;
  /** Check ids to skip, e.g. duplication-budget on repos that accept clones. */
  readonly skipChecks?: readonly string[];
  /** Known-duplicate dependency families. Providing this REPLACES the built-in defaults. */
  readonly dependencyOverlapGroups?: readonly (readonly string[])[];
  /** Duplication budget knobs passed to jscpd. */
  readonly duplication?: DuplicationOptions;
  /** Dead-export (knip) knobs. */
  readonly deadExports?: DeadExportsOptions;
  /** Explicit CSS build/selector probe. Unset: check skipped. */
  readonly closedDesignSystem?: ClosedDesignSystemOptions;
  /** Compiler strictness gate over resolved tsconfig files. Unset: check skipped; `{}` enables the defaults. */
  readonly tsconfigStrictness?: TsconfigStrictnessOptions;
};
