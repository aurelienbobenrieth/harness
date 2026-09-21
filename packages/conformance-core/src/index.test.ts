import { expect, it } from "vitest";
import { createFixture } from "./checks/test-support.js";
import { activeChecks, coreChecks, runCoreConformance } from "./index.js";

it("runs every check and aggregates findings", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ dependencies: { dayjs: "1.0.0", moment: "2.0.0" } }),
  });

  const findings = await runCoreConformance({
    root,
    dependencyOverlapGroups: [["dayjs", "moment"]],
  });
  const checkIds = findings.map((finding) => finding.check);
  expect(checkIds).toContain("dependency-overlap");
  expect(checkIds).toContain("duplication-budget");
  expect(checkIds).toContain("dead-exports");
  // closed-design-system-probe is config-gated and silent without the closedDesignSystem option.
  expect(checkIds).not.toContain("closed-design-system-probe");
  expect(findings.filter((finding) => finding.severity === "error")).toHaveLength(1);
});

it("honors skipChecks", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ dependencies: { dayjs: "1.0.0", moment: "2.0.0" } }),
  });

  const options = {
    root,
    skipChecks: ["dependency-overlap", "duplication-budget", "dead-exports"],
  };
  expect(activeChecks(options).map((check) => check.id)).toEqual(["closed-design-system-probe", "tsconfig-strictness"]);
  expect(await runCoreConformance(options)).toEqual([]);
});

it("exposes the five checks in order", () => {
  expect(coreChecks.map((check) => check.id)).toEqual([
    "dependency-overlap",
    "duplication-budget",
    "dead-exports",
    "closed-design-system-probe",
    "tsconfig-strictness",
  ]);
});
