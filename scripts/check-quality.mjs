import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { runCoreConformanceReport } from "../packages/conformance-core/dist/index.mjs";

const enforcedChecks = new Set(["duplication-budget", "instruction-blocks"]);
const report = await runCoreConformanceReport({
  root: process.cwd(),
  skipChecks: ["dependency-overlap", "closed-design-system-probe", "tsconfig-strictness"],
  // The always-on communication and economy rules are written once in their skills and carried by AGENTS.md.
  instructionBlocks: {
    blocks: { communication: "skills/communication/core.md", economy: "skills/economy/core.md" },
  },
  duplication: {
    requireTool: true,
    // Shared oxlint AST and test helpers live once in internal/oxlint-kit (bundled into each plugin).
    // The reviewed baseline left over: 9 near-duplicate blocks between sibling rules of one plugin
    // (effect, shopify-app, type-evidence), 4 between scripts/test-compatibility.mjs and
    // scripts/test-packages.mjs, and one each in agentlint judgment-support, conformance fs-support,
    // and the oxfmt/oxlint config entry points. Anything above it is new duplication.
    maxClones: 16,
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

// Keep Knip as the single owner of unused-code and dependency analysis.
const require = createRequire(import.meta.url);
const knip = spawnSync(process.execPath, [path.resolve(path.dirname(require.resolve("knip")), "../bin/knip.js")], {
  stdio: "inherit",
  windowsHide: true,
});
if (knip.status !== 0) process.exitCode = knip.status ?? 1;
