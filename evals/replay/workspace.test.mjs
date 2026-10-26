import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { removeOwnedTree, command, overlay } from "./workspace.mjs";

test("cleanup rejects the root and outside paths; junction target survives", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "replay-cleanup-"));
  const donor = await mkdtemp(path.join(tmpdir(), "replay-donor-"));

  try {
    const trial = path.join(root, "trial");

    await mkdir(trial);
    await writeFile(path.join(donor, "keep.txt"), "unchanged");
    await symlink(donor, path.join(trial, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(removeOwnedTree(root, root), /Unsafe/);
    await assert.rejects(removeOwnedTree(donor, root), /Unsafe/);
    await removeOwnedTree(trial, root);
    assert.equal(await readFile(path.join(donor, "keep.txt"), "utf8"), "unchanged");
    await removeOwnedTree(trial, root);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(donor, { recursive: true, force: true });
  }
});

test("hidden overlay restores existing tests and removes new ones after a failure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "replay-overlay-"));

  try {
    await writeFile(path.join(root, "test.ts"), "agent test");

    await assert.rejects(
      overlay(root, { "test.ts": "hidden", "new.ts": "new" }, async () => {
        assert.equal(await readFile(path.join(root, "test.ts"), "utf8"), "hidden");

        throw Error("test failure");
      }),
      /test failure/,
    );

    assert.equal(await readFile(path.join(root, "test.ts"), "utf8"), "agent test");
    await assert.rejects(readFile(path.join(root, "new.ts")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("process boundary keeps nonzero and timeout distinct from success", async () => {
  const failed = await command(process.execPath, ["-e", "process.exit(7)"], tmpdir());

  assert.equal(failed.status, 7);
  const timed = await command(process.execPath, ["-e", "setInterval(()=>{},1000)"], tmpdir(), 100);

  assert.equal(timed.killed, true);
});
