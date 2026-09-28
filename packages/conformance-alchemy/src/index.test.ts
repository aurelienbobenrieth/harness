import { describe, expect, it } from "vitest";
import { createFixture, stack } from "./checks/test-support.js";
import type { ConformanceCheck } from "./finding.js";
import { alchemyChecks, runAlchemyConformance, runAlchemyConformanceReport } from "./index.js";

const healthy = {
  "package.json": JSON.stringify({ name: "app", devDependencies: { alchemy: "2.0.0-beta.79" } }),
  ".gitignore": "node_modules/\n.alchemy/\n",
  "alchemy.run.ts": stack("Cloudflare.state()", ""),
  ".github/workflows/preview.yml": `on:
  pull_request:
    types: [opened, synchronize, closed]
jobs:
  deploy:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - run: pnpm alchemy deploy --stage pr-\${{ github.event.number }} --yes
  cleanup:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - run: pnpm alchemy destroy --stage pr-\${{ github.event.number }} --yes
`,
};

describe("runAlchemyConformanceReport", () => {
  it("passes only when every check is evaluated clean", async () => {
    const root = await createFixture(healthy);
    const report = await runAlchemyConformanceReport({ root });
    expect(report.findings).toEqual([]);
    expect(report.status).toBe("passed");
    expect(report.checks.map((check) => [check.check, check.status])).toEqual([
      ["alchemy-pinned-exact", "evaluated"],
      ["alchemy-state-gitignored", "evaluated"],
      ["ci-uses-remote-state", "evaluated"],
      ["preview-cleanup", "evaluated"],
    ]);
  });

  it("is incomplete, not passed, when workflows are missing or a check is skipped", async () => {
    const { ".github/workflows/preview.yml": _workflow, ...withoutCi } = healthy;
    const root = await createFixture(withoutCi);
    const report = await runAlchemyConformanceReport({ root, skipChecks: ["alchemy-pinned-exact"] });
    expect(report.status).toBe("incomplete");
    expect(report.checks.map((check) => check.status)).toEqual(["skipped", "evaluated", "unsupported", "unsupported"]);
    expect(report.checks[2]?.reason).toContain("No GitHub Actions workflow");
  });

  it("fails on an error finding and returns the flat findings", async () => {
    const root = await createFixture({ ...healthy, "alchemy.run.ts": stack("localState()") });
    const report = await runAlchemyConformanceReport({ root });
    expect(report.status).toBe("failed");
    expect(report.checks[2]?.status).toBe("evaluated");
    expect(await runAlchemyConformance({ root })).toHaveLength(2);
  });

  it("turns a throwing check into a failed evaluation and rejects unknown skips", async () => {
    const root = await createFixture(healthy);
    const throwing: ConformanceCheck = {
      id: "boom",
      description: "throws",
      docs: "https://alchemy.run/",
      run: () => Promise.reject(new Error("bad input")),
    };
    const report = await runAlchemyConformanceReport({ root }, [throwing]);
    expect(report.status).toBe("failed");
    expect(report.checks[0]?.reason).toBe("Check threw: bad input");
    await expect(runAlchemyConformanceReport({ root, skipChecks: ["typo"] })).rejects.toThrow("typo");
    expect(alchemyChecks).toHaveLength(4);
  });
});
