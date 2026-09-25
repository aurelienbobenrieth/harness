/* eslint-disable vitest/no-conditional-tests, vitest/no-disabled-tests -- Exclusions and missing evidence show up as skipped tests, never as passes. */
import { describe, expect, it } from "vitest";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "./finding.js";
import { assertKnownSkips, cloudflareChecks, evaluateCloudflareCheck } from "./index.js";

function describeFindings(findings: readonly ConformanceFinding[]): string {
  return findings
    .map((finding) => `  [${finding.severity}] ${finding.path ?? ""} ${finding.message}\n    ${finding.docs}`)
    .join("\n");
}

/**
 * Registers one Vitest test per Cloudflare conformance check.
 *
 * Errors and failed evaluations fail the test; warnings print. A check excluded by `skipChecks`, or one
 * whose evidence is unsupported (no wrangler install, TOML config), is reported as skipped.
 */
export function cloudflareConformance(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = cloudflareChecks,
): void {
  assertKnownSkips(options, checks);
  describe("cloudflare conformance", () => {
    for (const check of checks) {
      if (options.skipChecks?.includes(check.id)) {
        it.skip(`${check.id}: ${check.description}`, () => {});
        continue;
      }
      it(`${check.id}: ${check.description}`, async (context) => {
        const evaluation = await evaluateCloudflareCheck(check, options);
        const warnings = evaluation.findings.filter((finding) => finding.severity === "warning");
        if (warnings.length > 0) console.warn(`${check.id}\n${describeFindings(warnings)}`);
        const errors = evaluation.findings.filter((finding) => finding.severity === "error");
        expect(errors, `${check.docs}\n${describeFindings(evaluation.findings)}`).toEqual([]);
        expect(evaluation.status).not.toBe("failed");
        if (evaluation.status === "unsupported") context.skip(evaluation.reason);
      }, 125_000);
    }
  });
}
