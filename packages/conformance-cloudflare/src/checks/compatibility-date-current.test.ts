import { describe, expect, it } from "vitest";
import { compatibilityDateCurrent } from "./compatibility-date-current.js";
import { createFixture, wrangler } from "./test-support.js";

const now = "2026-09-24T12:00:00Z";

async function run(config: Record<string, unknown>, extra: { compatibilityDateMaxAgeDays?: number } = {}) {
  const root = await createFixture({ "wrangler.jsonc": wrangler(config) });
  return compatibilityDateCurrent.run({ root, now, ...extra });
}

describe("compatibility-date-current", () => {
  it("passes a recent date on the Node.js default and an older date that sets the flag", async () => {
    expect(await run({ compatibility_date: "2026-09-24" })).toEqual([]);
    expect(await run({ compatibility_date: "2026-08-03", compatibility_flags: ["nodejs_compat"] })).toEqual([]);
  });

  it("fails a missing, malformed, impossible, or future date", async () => {
    expect((await run({})).map((finding) => finding.severity)).toEqual(["error"]);
    expect((await run({ compatibility_date: "2026/09/01" }))[0]?.message).toContain("not a real YYYY-MM-DD");
    expect((await run({ compatibility_date: "2026-02-30" }))[0]?.message).toContain("not a real YYYY-MM-DD");
    const future = await run({ compatibility_date: "2026-09-25" });
    expect(future).toHaveLength(1);
    expect(future[0]?.message).toContain("in the future");
  });

  it("fails a date older than the age limit, counting whole UTC days", async () => {
    // 2026-03-28 is exactly 180 days before 2026-09-24.
    expect(await run({ compatibility_date: "2026-03-28", compatibility_flags: ["nodejs_compat"] })).toEqual([]);
    const stale = await run({ compatibility_date: "2026-03-27", compatibility_flags: ["nodejs_compat"] });
    expect(stale).toHaveLength(1);
    expect(stale[0]?.message).toContain("older than 180 days");
    expect(await run({ compatibility_date: "2026-09-01" }, { compatibilityDateMaxAgeDays: 30 })).toEqual([]);
    expect(await run({ compatibility_date: "2026-08-24" }, { compatibilityDateMaxAgeDays: 30 })).toHaveLength(1);
  });

  it("requires nodejs_compat only before 2026-08-04", async () => {
    const missing = await run({ compatibility_date: "2026-08-03" });
    expect(missing).toHaveLength(1);
    expect(missing[0]?.message).toContain("predates 2026-08-04");
    expect(await run({ compatibility_date: "2026-08-03", compatibility_flags: ["no_nodejs_compat"] })).toEqual([]);
    expect(await run({ compatibility_date: "2026-08-04" })).toEqual([]);
  });

  it("warns about a redundant flag from 2026-08-04 on", async () => {
    const findings = await run({ compatibility_date: "2026-08-04", compatibility_flags: ["nodejs_compat_v2"] });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("warning");
  });

  it("evaluates environments that override the date or flags, and only those", async () => {
    const findings = await run({
      compatibility_date: "2026-09-01",
      env: {
        staging: {},
        legacy: { compatibility_date: "2025-01-01" },
        flagged: { compatibility_flags: "nodejs_compat" },
      },
    });
    expect(findings.map((finding) => finding.message.split(":")[0])).toEqual([
      "env.legacy",
      "env.legacy",
      "env.flagged",
    ]);
  });

  it("rejects an invalid age limit or clock", async () => {
    const root = await createFixture({ "wrangler.jsonc": wrangler({ compatibility_date: "2026-09-01" }) });
    await expect(compatibilityDateCurrent.run({ root, compatibilityDateMaxAgeDays: 0 })).rejects.toThrow(
      "positive integer",
    );
    await expect(compatibilityDateCurrent.run({ root, now: "yesterday" })).rejects.toThrow("valid date");
  });
});
