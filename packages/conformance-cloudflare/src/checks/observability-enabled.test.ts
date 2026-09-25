import { describe, expect, it } from "vitest";
import { observabilityEnabled } from "./observability-enabled.js";
import { createFixture, wrangler } from "./test-support.js";

describe("observability-enabled", () => {
  it("passes when the top level enables logs and environments inherit it", async () => {
    const root = await createFixture({
      "wrangler.jsonc": wrangler({ observability: { enabled: true }, env: { staging: { vars: {} } } }),
    });
    expect(await observabilityEnabled.run({ root })).toEqual([]);
  });

  it("fails a missing top-level setting and an environment that turns logs off", async () => {
    const root = await createFixture({
      "wrangler.jsonc": wrangler({ env: { staging: { observability: { enabled: false } }, production: {} } }),
    });
    const findings = await observabilityEnabled.run({ root });
    expect(findings.map((finding) => finding.message.split(":")[0])).toEqual(["top level", "env.staging"]);
    expect(findings.every((finding) => finding.severity === "error")).toBe(true);
  });

  it("fails an environment override that omits enabled even when the top level enables logs", async () => {
    const root = await createFixture({
      "wrangler.jsonc": wrangler({
        observability: { enabled: true },
        env: { production: { observability: { head_sampling_rate: 0.1 } } },
      }),
    });
    const findings = await observabilityEnabled.run({ root });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("env.production");
  });

  it("reports TOML as unsupported evidence instead of passing", async () => {
    const root = await createFixture({ "wrangler.toml": "[observability]\nenabled = true\n" });
    const findings = await observabilityEnabled.run({ root });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: "warning", evaluation: "unsupported", path: "wrangler.toml" });
  });

  it("fails when no config exists or it is malformed", async () => {
    const empty = await createFixture({ "package.json": "{}" });
    expect(await observabilityEnabled.run({ root: empty })).toMatchObject([{ evaluation: "failed" }]);
    const broken = await createFixture({ "wrangler.json": "{ observability: " });
    expect(await observabilityEnabled.run({ root: broken })).toMatchObject([
      { evaluation: "failed", path: "wrangler.json" },
    ]);
  });

  it("prefers wrangler.json over wrangler.jsonc, like Wrangler", async () => {
    const root = await createFixture({
      "wrangler.json": wrangler({ observability: { enabled: true } }),
      "wrangler.jsonc": wrangler({}),
    });
    expect(await observabilityEnabled.run({ root })).toEqual([]);
  });

  it("reads JSONC comments and trailing commas in explicitly selected configs", async () => {
    const root = await createFixture({
      "workers/api/wrangler.jsonc": '{\n  // logs\n  "observability": { "enabled": true, },\n}\n',
    });
    expect(await observabilityEnabled.run({ root, wranglerConfigs: ["workers/api/wrangler.jsonc"] })).toEqual([]);
    await expect(observabilityEnabled.run({ root, wranglerConfigs: ["../outside.jsonc"] })).rejects.toThrow(
      "inside the project",
    );
  });
});
