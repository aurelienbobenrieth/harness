import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { draft } from "./draft.mjs";

test("groups staged paths, reads history, and preserves the index and working tree", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "git-draft-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  try {
    git("init", "-q");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@example.invalid");
    writeFileSync(path.join(cwd, "app.mjs"), "export const x=1;");
    git("add", "--", "app.mjs");
    git("commit", "-qm", "feat: initial app");
    assert.throws(() => draft(cwd), /No staged changes/u);
    writeFileSync(path.join(cwd, "app.test.mjs"), "// regression");
    git("add", "--", "app.test.mjs");
    const before = git("status", "--porcelain");
    const result = draft(cwd);
    assert.match(result, /^fix: <resulting behavior>/u);
    assert.match(result, /tests: app.test.mjs/u);
    assert.match(result, /feat: initial app/u);
    assert.equal(git("status", "--porcelain"), before);
    assert.equal(draft(cwd), result);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
