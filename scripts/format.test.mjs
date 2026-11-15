import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
test("formatting fixes spacing without reporting unrelated lint or loading project config", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "format-test-"));
  try {
    const file = path.join(directory, "sample.ts");
    writeFileSync(
      path.join(directory, ".oxlintrc.json"),
      JSON.stringify({ rules: { "missing-plugin/not-a-rule": "error" } }),
    );
    writeFileSync(file, "export function run() {\n  const unused = 1;\n  return 2;\n}\n");
    const cli = path.resolve(import.meta.dirname, "../packages/oxlint-plugin-core/bin/format-padding.mjs");
    const result = spawnSync(process.execPath, [cli, file], { cwd: directory, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(file, "utf8"), "export function run() {\n  const unused = 1;\n\n  return 2;\n}\n");
    assert.doesNotMatch(result.stdout, /Add a blank line|unused variable/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
