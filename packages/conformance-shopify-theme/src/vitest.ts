import { describe, expect, it } from "vitest";
import type { ConformanceFinding, ConformanceRunOptions } from "./finding.js";
import { activeChecks } from "./index.js";

function formatFindings(findings: readonly ConformanceFinding[]): string {
  return findings
    .map(
      (finding) =>
        `- [${finding.severity}] ${finding.message}${finding.path ? ` (${finding.path})` : ""}\n  ${finding.docs}`,
    )
    .join("\n");
}

/**
 * Registers one Vitest test per Shopify theme conformance check.
 *
 * Warnings are reported in the failure output only when an error is present;
 * a check with warnings alone passes.
 */
export function shopifyThemeConformance(options: ConformanceRunOptions): void {
  describe("shopify-theme conformance", () => {
    for (const check of activeChecks(options)) {
      it(`${check.id}: ${check.description}`, async () => {
        const findings = await check.run(options);
        const errors = findings.filter((finding) => finding.severity === "error");
        expect(errors, `${check.docs}\n${formatFindings(findings)}`).toEqual([]);
      });
    }
  });
}
