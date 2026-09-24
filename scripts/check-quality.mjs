import { runCoreConformanceReport } from "../packages/conformance-core/dist/index.mjs";

const enforcedChecks = new Set(["dead-exports", "duplication-budget"]);
const report = await runCoreConformanceReport({
  root: process.cwd(),
  skipChecks: ["dependency-overlap", "closed-design-system-probe", "tsconfig-strictness"],
  deadExports: { requireKnipConfig: true },
  duplication: {
    requireTool: true,
    // Each oxlint plugin keeps its own AST helpers so it publishes without a runtime helper dependency;
    // those per-package copies are the reviewed baseline. Anything above it is new duplication.
    maxClones: 37,
    minLines: 8,
    minTokens: 60,
    ignorePatterns: [
      "**/*.test.ts",
      "**/test-support.ts",
      "**/sota-test-support.ts",
      "**/*.md",
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "**/.tmp/**",
      "**/.stryker-tmp/**",
      "**/local-packages/**",
      "evals/**",
      "skills/**",
      "examples/**",
      "scripts/fixtures/**",
    ],
  },
});

for (const check of report.checks) {
  if (!enforcedChecks.has(check.check)) continue;
  console.log(`${check.check}: ${check.status}`);
  for (const finding of check.findings) console.error(`${finding.severity}: ${finding.message}`);
}

const failed = report.checks.some(
  (check) =>
    enforcedChecks.has(check.check) &&
    (check.status !== "evaluated" || check.findings.some((finding) => finding.severity === "error")),
);

if (failed) process.exitCode = 1;
