/* eslint-disable vitest/no-conditional-tests, vitest/no-disabled-tests -- Exclusions and missing evidence show up as skipped tests, never as passes. */
import { describe, expect, it } from "vitest";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions, ConformanceSeverity } from "./finding.js";
import { alchemyChecks, evaluateAlchemyCheck, selectAlchemyChecks } from "./index.js";

function render(findings: readonly ConformanceFinding[]): string {
  const lines: string[] = [];
  for (const finding of findings) {
    const location = finding.path === undefined ? "" : `${finding.path}: `;
    lines.push(`  ${finding.severity.toUpperCase()} ${location}${finding.message}`, `    see ${finding.docs}`);
  }
  return lines.join("\n");
}

/**
 * Registers one Vitest test per Alchemy conformance check.
 *
 * Errors and failed evaluations fail the test; warnings print. A check listed in `skipChecks`, or one whose
 * evidence is unsupported (no workflows directory, a dynamic working directory), is reported as skipped.
 */
export function alchemyConformance(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = alchemyChecks,
): void {
  const selected = selectAlchemyChecks(options, checks);
  describe("alchemy conformance", () => {
    for (const check of selected) {
      if ((options.skipChecks ?? []).includes(check.id)) {
        it.skip(`${check.id}: ${check.description}`, () => {});
        continue;
      }
      it(`${check.id}: ${check.description}`, async (context) => {
        const { status, reason, findings } = await evaluateAlchemyCheck(check, options);
        const bySeverity: Record<ConformanceSeverity, ConformanceFinding[]> = { error: [], warning: [] };
        for (const finding of findings) bySeverity[finding.severity].push(finding);
        if (bySeverity.warning.length > 0) console.warn(`${check.id}\n${render(bySeverity.warning)}`);
        expect(bySeverity.error, `${check.docs}\n${render(findings)}`).toEqual([]);
        expect(status).not.toBe("failed");
        if (status === "unsupported") context.skip(reason);
      }, 60_000);
    }
  });
}
