import { alchemyPinnedExact } from "./checks/alchemy-pinned-exact.js";
import { alchemyStateGitignored } from "./checks/alchemy-state-gitignored.js";
import { ciUsesRemoteState } from "./checks/ci-uses-remote-state.js";
import { previewCleanup } from "./checks/preview-cleanup.js";
import type {
  ConformanceCheck,
  ConformanceEvaluation,
  ConformanceFinding,
  ConformanceReport,
  ConformanceRunOptions,
} from "./finding.js";

export type {
  ConformanceCheck,
  ConformanceEvaluation,
  ConformanceFinding,
  ConformanceReport,
  ConformanceRunOptions,
  ConformanceSeverity,
} from "./finding.js";
export { alchemyPinnedExact, alchemyStateGitignored, ciUsesRemoteState, previewCleanup };

export const alchemyChecks: readonly ConformanceCheck[] = [
  alchemyPinnedExact,
  alchemyStateGitignored,
  ciUsesRemoteState,
  previewCleanup,
];

/** The checks to register, after rejecting `skipChecks` ids that name no check: a typo must not disable nothing. */
export function selectAlchemyChecks(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = alchemyChecks,
): readonly ConformanceCheck[] {
  const ids = new Set(checks.map((check) => check.id));
  const typos = (options.skipChecks ?? []).filter((skip) => !ids.has(skip));
  if (typos.length > 0) throw new Error(`Unknown Alchemy conformance check(s): ${typos.join(", ")}`);
  return checks;
}

function coverage(check: ConformanceCheck, findings: readonly ConformanceFinding[]): ConformanceEvaluation {
  const gap =
    findings.find((finding) => finding.evaluation === "failed") ??
    findings.find((finding) => finding.evaluation === "unsupported");
  if (gap?.evaluation === undefined) return { check: check.id, status: "evaluated", findings };
  return { check: check.id, status: gap.evaluation, reason: gap.message, findings };
}

/**
 * Runs one check and classifies its coverage: excluded checks are `skipped`, missing evidence is
 * `unsupported` or `failed`, and a check that throws becomes a `failed` evaluation instead of aborting.
 */
export async function evaluateAlchemyCheck(
  check: ConformanceCheck,
  options: ConformanceRunOptions,
): Promise<ConformanceEvaluation> {
  if ((options.skipChecks ?? []).includes(check.id))
    return { check: check.id, status: "skipped", reason: "Excluded by skipChecks.", findings: [] };
  const outcome = await check.run(options).then(
    (findings) => ({ findings }),
    (error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }),
  );
  if ("findings" in outcome) return coverage(check, outcome.findings);
  const reason = `Check threw: ${outcome.error}`;
  return {
    check: check.id,
    status: "failed",
    reason,
    findings: [{ check: check.id, severity: "error", evaluation: "failed", message: reason, docs: check.docs }],
  };
}

/**
 * Evaluates every check. `failed` on any error finding or failed evaluation; `incomplete` when a check was
 * skipped or lacked evidence; `passed` otherwise. A pass covers only these static checks, not a deploy.
 */
export async function runAlchemyConformanceReport(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = alchemyChecks,
): Promise<ConformanceReport> {
  const evaluations: ConformanceEvaluation[] = [];
  for (const check of selectAlchemyChecks(options, checks))
    evaluations.push(await evaluateAlchemyCheck(check, options));
  const findings = evaluations.flatMap((evaluation) => evaluation.findings);
  const statuses = new Set(evaluations.map((evaluation) => evaluation.status));
  if (statuses.has("failed") || findings.some((finding) => finding.severity === "error"))
    return { status: "failed", checks: evaluations, findings };
  return {
    status: statuses.size === 1 && statuses.has("evaluated") ? "passed" : "incomplete",
    checks: evaluations,
    findings,
  };
}

/** Flat findings of every non-skipped check. Prefer the report: it separates violations from missing evidence. */
export async function runAlchemyConformance(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = alchemyChecks,
): Promise<readonly ConformanceFinding[]> {
  return (await runAlchemyConformanceReport(options, checks)).findings;
}
