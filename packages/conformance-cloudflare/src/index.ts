import { compatibilityDateCurrent } from "./checks/compatibility-date-current.js";
import { environmentBindingsRedeclared } from "./checks/environment-bindings-redeclared.js";
import { hyperdriveContract } from "./checks/hyperdrive-contract.js";
import { noSecretsInVars } from "./checks/no-secrets-in-vars.js";
import { observabilityEnabled } from "./checks/observability-enabled.js";
import { wranglerTypesCurrent } from "./checks/wrangler-types-current.js";
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
  WranglerTypesOptions,
} from "./finding.js";
export {
  compatibilityDateCurrent,
  environmentBindingsRedeclared,
  hyperdriveContract,
  noSecretsInVars,
  observabilityEnabled,
  wranglerTypesCurrent,
};

export const cloudflareChecks: readonly ConformanceCheck[] = [
  wranglerTypesCurrent,
  noSecretsInVars,
  environmentBindingsRedeclared,
  compatibilityDateCurrent,
  observabilityEnabled,
  hyperdriveContract,
];

/** Rejects unknown ids in `skipChecks`, so a typo cannot silently disable nothing. */
export function assertKnownSkips(options: ConformanceRunOptions, checks: readonly ConformanceCheck[]): void {
  const known = new Set(checks.map((check) => check.id));
  const unknown = (options.skipChecks ?? []).filter((skip) => !known.has(skip));
  if (unknown.length > 0) throw new Error(`Unknown Cloudflare conformance check(s): ${unknown.join(", ")}`);
}

/**
 * Runs one check and classifies its coverage. Missing evidence surfaces as `unsupported` or `failed`, and a
 * throwing check becomes a `failed` evaluation instead of aborting the run.
 */
export async function evaluateCloudflareCheck(
  check: ConformanceCheck,
  options: ConformanceRunOptions,
): Promise<ConformanceEvaluation> {
  if (options.skipChecks?.includes(check.id))
    return { check: check.id, status: "skipped", reason: "Excluded by skipChecks.", findings: [] };
  let findings: readonly ConformanceFinding[];
  try {
    findings = await check.run(options);
  } catch (error) {
    const reason = `Check threw: ${error instanceof Error ? error.message : String(error)}`;
    const finding: ConformanceFinding = {
      check: check.id,
      severity: "error",
      evaluation: "failed",
      message: reason,
      docs: check.docs,
    };
    return { check: check.id, status: "failed", reason, findings: [finding] };
  }
  for (const status of ["failed", "unsupported"] as const) {
    const gap = findings.find((finding) => finding.evaluation === status);
    if (gap !== undefined) return { check: check.id, status, reason: gap.message, findings };
  }
  return { check: check.id, status: "evaluated", findings };
}

/**
 * Evaluates every check and summarizes: `failed` on any error or failed evaluation, `incomplete` when a
 * check was skipped or lacked evidence, `passed` otherwise. A pass covers only these static checks.
 */
export async function runCloudflareConformanceReport(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = cloudflareChecks,
): Promise<ConformanceReport> {
  assertKnownSkips(options, checks);
  const evaluations: ConformanceEvaluation[] = [];
  for (const check of checks) evaluations.push(await evaluateCloudflareCheck(check, options));
  const findings = evaluations.flatMap((evaluation) => evaluation.findings);
  const failed =
    evaluations.some((evaluation) => evaluation.status === "failed") ||
    findings.some((finding) => finding.severity === "error");
  const complete = evaluations.every((evaluation) => evaluation.status === "evaluated");
  return { status: failed ? "failed" : complete ? "passed" : "incomplete", checks: evaluations, findings };
}

/** Flat findings of every non-skipped check. Prefer the report: it separates violations from missing evidence. */
export async function runCloudflareConformance(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = cloudflareChecks,
): Promise<readonly ConformanceFinding[]> {
  return (await runCloudflareConformanceReport(options, checks)).findings;
}
