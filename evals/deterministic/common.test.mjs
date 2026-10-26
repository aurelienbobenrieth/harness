import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { safeWrite, read, lint, normalizeSeedText, excerpt } from "./common.mjs";
test("rejects a seed escaping its temporary consumer copy", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "det-test-"));
  try {
    assert.throws(() => safeWrite(dir, { "../outside.ts": "bad" }), /Unsafe seeded path/);
    assert.equal(existsSync(path.join(dir, "outside.ts")), false);
    safeWrite(dir, { "src/sample.ts": "const value = 1;" });
    assert.equal(read(path.join(dir, "src/sample.ts")), "const value = 1;");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("records an invalid lint configuration as a failure, not zero hits", () => {
  const result = lint({ rules: { "missing-plugin/no-rule": "error" } }, import.meta.filename);
  assert.match(result.error, /Invalid oxlint JSON/);
  assert.notEqual(result.exit, 0);
});

import { CostGuard } from "../lib/runner.mjs";
test("cost reservations include prior spend and concurrent reservations", () => {
  const guard = new CostGuard(1);
  const settle = guard.reserve(0.6);
  assert.throws(() => guard.reserve(0.5), /exceeds/);
  settle(0.7);
  settle(0.7);
  assert.equal(guard.spent, 0.7);
  assert.throws(() => guard.reserve(0.4), /exceeds/);
});

test("decodes a whole-file escaped seed and preserves normal source regexes", () => {
  assert.equal(normalizeSeedText(String.raw`{\"name\":\"sample\"}`), '{"name":"sample"}');
  assert.equal(
    normalizeSeedText(String.raw`name: sample\njobs:\n  deploy: {}\n`),
    "name: sample\njobs:\n  deploy: {}\n",
  );
  assert.equal(normalizeSeedText(String.raw`const separator = /\n/;`), String.raw`const separator = /\n/;`);
});
test("excerpts decode oxlint byte offsets after non-ASCII source", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "det-excerpt-"));
  try {
    safeWrite(dir, {
      "sample.ts": "// " + "é".repeat(200) + "\nconst target = 1;\n" + "const trailing = 2;\n".repeat(30),
    });
    assert.match(excerpt(dir, { filename: "sample.ts", labels: [{ span: { offset: 404 } }] }), /2: const target = 1;/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
