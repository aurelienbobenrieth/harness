import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { affected, run } from "./affected.mjs";

test("selects transitive consumers, excludes unrelated tests, and reports failures honestly", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "affected-tests-"));
  try {
    writeFileSync(path.join(cwd, "core.mjs"), "export const value = 2;");
    writeFileSync(path.join(cwd, "service.mjs"), "export {value} from './core.mjs';");
    writeFileSync(
      path.join(cwd, "service.test.mjs"),
      "import test from 'node:test';import assert from 'node:assert/strict';import {value} from './service.mjs';test('value',()=>assert.equal(value,2));",
    );
    writeFileSync(path.join(cwd, "other.test.mjs"), "throw Error('unrelated');");
    assert.deepEqual(affected(cwd, ["core.mjs"]), ["service.test.mjs"]);
    assert.equal(run(["core.mjs"], cwd).status, 0);
    writeFileSync(path.join(cwd, "core.mjs"), "export const value = 3;");
    assert.equal(run(["core.mjs"], cwd).status, 1);
    assert.match(run(["core.mjs"], cwd).summary, /not ok/u);
    assert.equal(run(["unknown.mjs"], cwd).status, 2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
