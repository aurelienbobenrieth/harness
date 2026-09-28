import type { ConformanceFinding } from "@aurelienbbn/conformance-core";

// The finding and report model is conformance-core's; its declarations are inlined at build time (tsdown `dts.resolve`),
// so consumers need no dependency on conformance-core.
export type {
  ConformanceEvaluation,
  ConformanceFinding,
  ConformanceReport,
  ConformanceSeverity,
} from "@aurelienbbn/conformance-core";

export type ConformanceCheck = {
  readonly id: string;
  readonly description: string;
  readonly docs: string;
  readonly run: (options: ConformanceRunOptions) => Promise<readonly ConformanceFinding[]>;
};

export type ConformanceRunOptions = {
  /** Repository root: workflows, `.gitignore` files and workspace manifests are read relative to it. */
  readonly root: string;
  /** Check ids to exclude; they are reported as skipped, never as passed. Unknown ids throw. */
  readonly skipChecks?: readonly string[];
  /** Project-relative globs of stack entrypoints. Default: `["**\/alchemy.run.ts"]`, `node_modules` excluded. */
  readonly stackFiles?: readonly string[];
  /** Project-relative directory of GitHub Actions workflows. Default: `.github/workflows`. */
  readonly workflowsDir?: string;
};
