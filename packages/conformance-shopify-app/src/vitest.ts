import { describe, expect, it } from "vitest";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "./finding.js";
import { shopifyAppChecks } from "./index.js";

function formatFindings(findings: readonly ConformanceFinding[]): string {
  return findings
    .map(
      (finding) =>
        `- [${finding.severity}] ${finding.message}${finding.path ? ` (${finding.path})` : ""}\n  ${finding.docs}`,
    )
    .join("\n");
}

/**
 * Registers one Vitest test per Shopify app conformance check.
 *
 * Warnings are printed even when no error is present;
 * a check with warnings alone passes. `checks` replaces the default list, which excludes
 * `optionalShopifyAppChecks`.
 */
export function shopifyAppConformance(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = shopifyAppChecks,
): void {
  describe("shopify-app conformance", () => {
    for (const check of checks) {
      it(`${check.id}: ${check.description}`, async () => {
        const findings = await check.run(options);
        const warnings = findings.filter((finding) => finding.severity === "warning");
        if (warnings.length > 0)
          console.warn(warnings.map((finding) => `[${finding.check}] ${finding.message}`).join("\n"));
        const errors = findings.filter((finding) => finding.severity === "error");
        expect(errors, `${check.docs}\n${formatFindings(findings)}`).toEqual([]);
      });
    }
  });
}
