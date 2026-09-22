import { expect, it } from "vitest";
import { createFixture } from "./checks/test-support.js";
import type { ConformanceCheck } from "./finding.js";
import { evaluateCoreCheck, runCoreConformanceReport } from "./report.js";

const throwingCheck = (failure: Error | string): ConformanceCheck => ({
  id: "throwing-probe",
  description: "probe",
  docs: "https://example.com/probe",
  run: async () => {
    throw failure;
  },
});

it("reports missing optional tools and an unconfigured probe as incomplete evidence", async () => {
  const root = await createFixture({ "package.json": "{}" });
  const report = await runCoreConformanceReport({ root });
  expect(report.status).toBe("incomplete");
  expect(report.checks.map((check) => [check.check, check.status])).toEqual([
    ["dependency-overlap", "evaluated"],
    ["duplication-budget", "unsupported"],
    ["dead-exports", "unsupported"],
    ["closed-design-system-probe", "skipped"],
    ["tsconfig-strictness", "skipped"],
  ]);
  expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  expect(report.checks.find((check) => check.check === "closed-design-system-probe")).toEqual({
    check: "closed-design-system-probe",
    status: "skipped",
    reason: "No CSS build/selector probe configured.",
    findings: [],
  });
  expect(report.checks.find((check) => check.check === "tsconfig-strictness")).toEqual({
    check: "tsconfig-strictness",
    status: "skipped",
    reason: "No tsconfigStrictness options configured; pass {} to enable the default baseline.",
    findings: [],
  });
});

it("preserves unavailable evidence and gives execution failure priority", async () => {
  const check: ConformanceCheck = {
    id: "probe",
    description: "probe",
    docs: "https://example.com/probe",
    run: async () => [
      { check: "probe", severity: "warning", message: "ordinary", docs: "https://example.com/probe" },
      {
        check: "probe",
        severity: "warning",
        evaluation: "unsupported",
        message: "tool absent",
        docs: "https://example.com/probe",
      },
      {
        check: "probe",
        severity: "error",
        evaluation: "failed",
        message: "invalid report",
        docs: "https://example.com/probe",
      },
    ],
  };

  await expect(evaluateCoreCheck(check, { root: "." })).resolves.toMatchObject({
    status: "failed",
    reason: "invalid report",
  });

  await expect(
    evaluateCoreCheck(
      {
        ...check,
        run: async () => [
          { check: "probe", severity: "warning", message: "ordinary", docs: "https://example.com/probe" },
          {
            check: "probe",
            severity: "warning",
            evaluation: "unsupported",
            message: "tool absent",
            docs: "https://example.com/probe",
          },
        ],
      },
      { root: "." },
    ),
  ).resolves.toMatchObject({ status: "unsupported", reason: "tool absent" });
});

it("turns thrown Error and non-Error values into failed evidence", async () => {
  await expect(evaluateCoreCheck(throwingCheck(new Error("boom")), { root: "." })).resolves.toEqual({
    check: "throwing-probe",
    status: "failed",
    reason: "Check execution failed: boom",
    findings: [
      {
        check: "throwing-probe",
        severity: "error",
        evaluation: "failed",
        message: "Check execution failed: boom",
        docs: "https://example.com/probe",
      },
    ],
  });
  await expect(evaluateCoreCheck(throwingCheck("broken"), { root: "." })).resolves.toMatchObject({
    reason: "Check execution failed: broken",
  });
});

it("keeps explicit skips visible and rejects misspelled check IDs", async () => {
  const root = await createFixture({});
  const report = await runCoreConformanceReport({ root, skipChecks: ["dead-exports"] });
  expect(report.checks.find((check) => check.check === "dead-exports")).toMatchObject({
    status: "skipped",
    reason: "Excluded by skipChecks.",
    findings: [],
  });
  await expect(runCoreConformanceReport({ root, skipChecks: ["dead-export"] })).rejects.toThrow("Unknown core");
});

it("distinguishes an evaluated violation from missing required evidence", async () => {
  const root = await createFixture({
    "package.json": '{"dependencies":{"dayjs":"1","moment":"2"}}',
  });
  const report = await runCoreConformanceReport({
    root,
    dependencyOverlapGroups: [["dayjs", "moment"]],
    duplication: { requireTool: true },
  });
  expect(report.status).toBe("failed");
  expect(report.checks.find((check) => check.check === "dependency-overlap")).toMatchObject({
    status: "evaluated",
    findings: [expect.objectContaining({ severity: "error" })],
  });
  expect(report.checks.find((check) => check.check === "duplication-budget")).toMatchObject({
    status: "unsupported",
    findings: [expect.objectContaining({ severity: "error" })],
  });
});

it("does not turn a malformed tool report into evaluated clean evidence", async () => {
  const root = await createFixture({
    "node_modules/knip/package.json": '{"name":"knip","bin":{"knip":"bin.cjs"}}',
    "node_modules/knip/bin.cjs": "console.log(JSON.stringify({files: [null], issues: []}))",
  });
  const report = await runCoreConformanceReport({ root });
  expect(report.status).toBe("failed");
  expect(report.checks.find((check) => check.check === "dead-exports")?.status).toBe("failed");
});

it("passes only after all five checks evaluate successfully", async () => {
  const root = await createFixture({
    "package.json": "{}",
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        verbatimModuleSyntax: true,
        erasableSyntaxOnly: true,
      },
    }),
    "knip.json": "{}",
    "node_modules/knip/package.json": '{"name":"knip","bin":{"knip":"bin.cjs"}}',
    "node_modules/knip/bin.cjs": "console.log(JSON.stringify({ files: [], issues: [] }))",
    "node_modules/jscpd/package.json": '{"name":"jscpd","bin":{"jscpd":"bin.cjs"}}',
    "node_modules/jscpd/bin.cjs":
      'const output = process.argv[process.argv.indexOf("--output") + 1]; require("node:fs").writeFileSync(require("node:path").join(output, "jscpd-report.json"), JSON.stringify({ duplicates: [] }));',
  });
  const report = await runCoreConformanceReport({
    root,
    duplication: { requireTool: true },
    deadExports: { requireKnipConfig: true },
    closedDesignSystem: {
      stylesheet: "theme.css",
      requiredSelectors: [".token"],
      forbiddenSelectors: [".raw"],
      buildCommand: [
        process.execPath,
        "-e",
        "require('node:fs').writeFileSync(process.argv[1], '.token {}')",
        "{output}",
      ],
    },
    tsconfigStrictness: {},
  });
  expect(report.status).toBe("passed");
  expect(report.checks.map((check) => check.status)).toEqual([
    "evaluated",
    "evaluated",
    "evaluated",
    "evaluated",
    "evaluated",
  ]);
  expect(report.findings).toEqual([]);
});
