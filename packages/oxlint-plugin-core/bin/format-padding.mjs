#!/usr/bin/env node
/** Apply statement spacing as formatting, without loading the consumer's lint findings. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const temporary = mkdtempSync(path.join(tmpdir(), "harness-padding-"));
try {
  const config = path.join(temporary, "oxlint.json");
  writeFileSync(
    config,
    JSON.stringify({
      categories: { correctness: "off" },
      jsPlugins: [pathToFileURL(path.resolve(import.meta.dirname, "../dist/index.mjs")).href],
      rules: { "core/padding-line-between-statements": "error" },
    }),
  );
  const binary = path.join(path.dirname(require.resolve("oxlint/package.json")), "bin/oxlint");
  const args = process.argv.slice(2);
  const result = spawnSync(process.execPath, [binary, "--config", config, "--fix", ...(args.length ? args : ["."])], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
