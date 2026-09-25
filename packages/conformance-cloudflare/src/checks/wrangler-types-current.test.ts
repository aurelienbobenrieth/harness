import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { wranglerTypesCurrent } from "./wrangler-types-current.js";
import { createFixture, wrangler } from "./test-support.js";

const manifest = JSON.stringify({ name: "wrangler", version: "0.0.0-test", bin: { wrangler: "bin/wrangler.js" } });

/** A stand-in Wrangler that records its argv and exits with the given code. */
function fakeWrangler(exitCode: number, body = ""): Record<string, string> {
  return {
    "node_modules/wrangler/package.json": manifest,
    "node_modules/wrangler/bin/wrangler.js": `require("node:fs").writeFileSync("argv.json", JSON.stringify(process.argv.slice(2)));
${body}
console.error("types are out of date");
process.exit(${exitCode});`,
  };
}

describe("wrangler-types-current", () => {
  it("passes when wrangler types --check exits 0, passing the selected config and extra args", async () => {
    const root = await createFixture({ "wrangler.jsonc": wrangler({}), ...fakeWrangler(0) });
    expect(await wranglerTypesCurrent.run({ root, wranglerTypes: { args: ["src/env.d.ts"] } })).toEqual([]);
    expect(JSON.parse(await readFile(path.join(root, "argv.json"), "utf8"))).toEqual([
      "types",
      "--check",
      "--config",
      path.join(root, "wrangler.jsonc"),
      "src/env.d.ts",
    ]);
  });

  it("fails on a non-zero exit with the tool output", async () => {
    const root = await createFixture({ "wrangler.toml": 'name = "w"\n', ...fakeWrangler(1) });
    const findings = await wranglerTypesCurrent.run({ root });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("error");
    expect(findings[0]?.message).toContain("types are out of date");
    expect(findings[0]?.evaluation).toBeUndefined();
  });

  it("runs from the Worker's directory in a monorepo, resolving a hoisted wrangler", async () => {
    const root = await createFixture({ "apps/api/wrangler.jsonc": wrangler({}), ...fakeWrangler(0) });
    expect(await wranglerTypesCurrent.run({ root, wranglerConfigs: ["apps/api/wrangler.jsonc"] })).toEqual([]);
    expect(await readFile(path.join(root, "apps/api/argv.json"), "utf8")).toContain("types");
  });

  it("reports a missing wrangler install as unsupported, not as a pass", async () => {
    const root = await createFixture({ "wrangler.jsonc": wrangler({}) });
    const findings = await wranglerTypesCurrent.run({ root });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: "warning", evaluation: "unsupported" });
  });

  it("reports a timeout as a failed evaluation", async () => {
    const root = await createFixture({
      "wrangler.jsonc": wrangler({}),
      ...fakeWrangler(0, "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);"),
    });
    const findings = await wranglerTypesCurrent.run({ root, wranglerTypes: { timeoutMs: 300 } });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: "error", evaluation: "failed" });
  });

  it("fails when no config exists", async () => {
    const root = await createFixture(fakeWrangler(0));
    expect(await wranglerTypesCurrent.run({ root })).toMatchObject([{ evaluation: "failed" }]);
  });
});
