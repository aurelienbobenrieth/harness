import { expect, it } from "vitest";
import { defineStrictOxlintConfig } from "@aurelienbbn/oxlint-config";
import { defineOxfmtConfig } from "@aurelienbbn/oxfmt-config";
import { coreConformance } from "@aurelienbbn/conformance-core/vitest";
import { shopifyAppConformance } from "@aurelienbbn/conformance-shopify-app/vitest";
import { runCoreConformanceReport } from "@aurelienbbn/conformance-core";

coreConformance({
  root: process.cwd(),
  dependencyOverlapGroups: [],
  skipChecks: ["dead-exports", "duplication-budget"],
});
shopifyAppConformance({ root: process.cwd(), appManifest: "shopify.app.production.toml" });
it("uses packed configuration builders without sharing mutable state", () => {
  const first = defineStrictOxlintConfig({ plugins: ["typescript"] }, { replaceLists: true });
  expect(first.plugins).toEqual(["typescript"]);
  first.plugins?.push("node");
  expect(defineStrictOxlintConfig({ plugins: ["typescript"] }, { replaceLists: true }).plugins).toEqual(["typescript"]);
  expect(defineOxfmtConfig({ ignorePatterns: ["generated/**"] }, { replaceLists: true }).ignorePatterns).toEqual([
    "generated/**",
  ]);
});

it("exposes incomplete core evidence to consumers", async () => {
  const report = await runCoreConformanceReport({ root: process.cwd(), dependencyOverlapGroups: [] });
  expect(report.status).toBe("incomplete");
  expect(report.checks.find((check) => check.check === "closed-design-system-probe")?.status).toBe("skipped");
});

/** These calls are compiled, never executed; unused @ts-expect-error directives fail tsc. */
export function rejectInvalidConsumerOptions(): void {
  // @ts-expect-error A format width is numeric.
  defineOxfmtConfig({ printWidth: "wide" });
  // @ts-expect-error List replacement is a boolean, not a coercible string.
  defineStrictOxlintConfig({}, { replaceLists: "true" });
  // @ts-expect-error Required tool selection is boolean.
  void runCoreConformanceReport({ root: ".", duplication: { requireTool: "yes" } });
}
