import type { ConformanceCheck, ConformanceEvaluation, ConformanceReport, ConformanceRunOptions } from "./finding.js";
import { activeChecks, coreChecks } from "./registry.js";

/** Names why an opt-in check has nothing to evaluate, or undefined when it is configured. */
export function unconfiguredReason(check: ConformanceCheck, options: ConformanceRunOptions): string | undefined {
  if (check.id === "closed-design-system-probe" && options.closedDesignSystem === undefined)
    return "No CSS build/selector probe configured.";
  if (check.id === "tsconfig-strictness" && options.tsconfigStrictness === undefined)
    return "No tsconfigStrictness options configured; pass {} to enable the default baseline.";
  return undefined;
}

/** Evaluates one registered check without conflating a violation with missing evidence. */
export async function evaluateCoreCheck(
  check: ConformanceCheck,
  options: ConformanceRunOptions,
): Promise<ConformanceEvaluation> {
  if (options.skipChecks?.includes(check.id))
    return { check: check.id, status: "skipped", reason: "Excluded by skipChecks.", findings: [] };
  const unconfigured = unconfiguredReason(check, options);
  if (unconfigured !== undefined) return { check: check.id, status: "skipped", reason: unconfigured, findings: [] };
  try {
    const findings = await check.run(options);
    const unavailable =
      findings.find((finding) => finding.evaluation === "failed") ??
      findings.find((finding) => finding.evaluation === "unsupported");
    return {
      check: check.id,
      status: unavailable?.evaluation ?? "evaluated",
      ...(unavailable ? { reason: unavailable.message } : {}),
      findings,
    };
  } catch (error) {
    const message = `Check execution failed: ${error instanceof Error ? error.message : String(error)}`;
    return {
      check: check.id,
      status: "failed",
      reason: message,
      findings: [{ check: check.id, severity: "error", evaluation: "failed", message, docs: check.docs }],
    };
  }
}

/** Reports every registered check, including explicit exclusions and unavailable tool evidence.
 * "passed" applies only to the configured static checks; it does not establish runtime compliance.
 */
export async function runCoreConformanceReport(options: ConformanceRunOptions): Promise<ConformanceReport> {
  activeChecks(options);
  const checks: ConformanceEvaluation[] = [];
  for (const check of coreChecks) checks.push(await evaluateCoreCheck(check, options));
  const findings = checks.flatMap((check) => check.findings);
  const failed =
    findings.some((finding) => finding.severity === "error") || checks.some((check) => check.status === "failed");
  return {
    status: failed ? "failed" : checks.some((check) => check.status !== "evaluated") ? "incomplete" : "passed",
    checks,
    findings,
  };
}
