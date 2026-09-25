import { describe, expect, it } from "vitest";
import { cloudflareChecks, runCloudflareConformance, runCloudflareConformanceReport } from "./index.js";
import type { ConformanceCheck } from "./finding.js";
import { createFixture, wrangler } from "./checks/test-support.js";

const healthy = wrangler({ compatibility_date: "2026-09-20", observability: { enabled: true } });
const now = "2026-09-24";

describe("runCloudflareConformanceReport", () => {
  it("is incomplete, not passed, when wrangler is absent even though every config check is clean", async () => {
    const root = await createFixture({ "wrangler.jsonc": healthy, "package.json": "{}" });
    const report = await runCloudflareConformanceReport({ root, now });
    expect(report.status).toBe("incomplete");
    expect(report.checks.map((check) => [check.check, check.status])).toEqual([
      ["wrangler-types-current", "unsupported"],
      ["no-secrets-in-vars", "evaluated"],
      ["environment-bindings-redeclared", "evaluated"],
      ["compatibility-date-current", "evaluated"],
      ["observability-enabled", "evaluated"],
      ["hyperdrive-contract", "evaluated"],
    ]);
  });

  it("passes only when every check is evaluated clean", async () => {
    const root = await createFixture({ "wrangler.jsonc": healthy, "package.json": "{}" });
    const report = await runCloudflareConformanceReport({ root, now, skipChecks: [] }, cloudflareChecks.slice(1));
    expect(report.status).toBe("passed");
    expect(report.findings).toEqual([]);
  });

  it("fails on an error finding and counts skipped checks as incomplete", async () => {
    const root = await createFixture({ "wrangler.jsonc": wrangler({ compatibility_date: "2026-09-20" }) });
    const report = await runCloudflareConformanceReport({ root, now, skipChecks: ["wrangler-types-current"] });
    expect(report.status).toBe("failed");
    expect(report.checks[0]).toEqual({
      check: "wrangler-types-current",
      status: "skipped",
      reason: "Excluded by skipChecks.",
      findings: [],
    });
    expect(await runCloudflareConformance({ root, now, skipChecks: ["wrangler-types-current"] })).toHaveLength(2);
  });

  it("turns a throwing check into a failed evaluation and rejects unknown skips", async () => {
    const root = await createFixture({ "wrangler.jsonc": healthy });
    const throwing: ConformanceCheck = {
      id: "boom",
      description: "throws",
      docs: "https://example.com",
      run: () => Promise.reject(new Error("bad input")),
    };
    const report = await runCloudflareConformanceReport({ root }, [throwing]);
    expect(report.status).toBe("failed");
    expect(report.checks[0]?.reason).toBe("Check threw: bad input");
    await expect(runCloudflareConformanceReport({ root, skipChecks: ["typo"] })).rejects.toThrow("typo");
  });
});
