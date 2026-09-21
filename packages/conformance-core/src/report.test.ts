import { expect, it } from "vitest";
import { createFixture } from "./checks/test-support.js";
import { runCoreConformanceReport } from "./report.js";

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
