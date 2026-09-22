/* eslint-disable vitest/no-conditional-tests, vitest/no-disabled-tests -- Consumer exclusions are reported as skipped tests instead of silently passing. */
import { describe, expect, it } from "vitest";
import type { ConformanceFinding, ConformanceRunOptions } from "./finding.js";
import { activeChecks, coreChecks } from "./registry.js";
import { evaluateCoreCheck, unconfiguredReason } from "./report.js";

function formatFindings(findings: readonly ConformanceFinding[]): string {
  return findings
    .map(
      (finding) =>
        `- [${finding.severity}] ${finding.message}${finding.path ? ` (${finding.path})` : ""}\n  ${finding.docs}`,
    )
    .join("\n");
}

/**
 * Registers one Vitest test per quality conformance check.
 *
 * Evaluated advice passes; unavailable evidence is skipped and failed execution fails,
 * independently of an optional tool finding's warning severity.
 */
export function coreConformance(options: ConformanceRunOptions): void {
  activeChecks(options);
  describe("core conformance", () => {
    for (const check of coreChecks) {
      if (options.skipChecks?.includes(check.id) || unconfiguredReason(check, options) !== undefined) {
        it.skip(`${check.id}: ${check.description}`, () => {});
        continue;
      }
      it(`${check.id}: ${check.description}`, async (context) => {
        const evaluation = await evaluateCoreCheck(check, options);
        const findings = evaluation.findings;
        const warnings = findings.filter((finding) => finding.severity === "warning");
        if (warnings.length > 0) console.warn(formatFindings(warnings));
        const errors = findings.filter((finding) => finding.severity === "error");
        expect(errors, `${check.docs}\n${formatFindings(findings)}`).toEqual([]);
        expect(evaluation).not.toMatchObject({ status: "failed" });
        if (evaluation.status === "unsupported" || evaluation.status === "skipped") context.skip(evaluation.reason);
      }, 125_000);
    }
  });
}
