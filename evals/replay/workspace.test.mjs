import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { removeOwnedTree, command, overlay, git, contents } from "./workspace.mjs";

test("cleanup rejects the root and outside paths; junction target survives", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "replay-cleanup-"));
  const donor = await mkdtemp(path.join(tmpdir(), "replay-donor-"));

  try {
    const trial = path.join(root, "trial");

    await mkdir(trial);
    await writeFile(path.join(donor, "keep.txt"), "unchanged");
    await symlink(
      donor,
      path.join(trial, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
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
    await writeFile(path.join(root, "deleted.ts"), "restore after deletion");

    await assert.rejects(
      overlay(root, { "test.ts": "hidden", "new.ts": "new", "deleted.ts": null }, async () => {
        assert.equal(await readFile(path.join(root, "test.ts"), "utf8"), "hidden");
        await assert.rejects(readFile(path.join(root, "deleted.ts")), { code: "ENOENT" });

        throw Error("test failure");
      }),
      /test failure/,
    );

    assert.equal(await readFile(path.join(root, "test.ts"), "utf8"), "agent test");
    assert.equal(await readFile(path.join(root, "deleted.ts"), "utf8"), "restore after deletion");
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

test("trial changes are measured from the pinned parent even after an agent commit", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "replay-base-"));

  try {
    await git(root, "init", "-q");
    await git(root, "config", "user.name", "Replay Fixture");
    await git(root, "config", "user.email", "replay@example.invalid");
    await writeFile(path.join(root, "subject.ts"), "export const answer = 1;");
    await git(root, "add", "--", "subject.ts");
    await git(root, "commit", "-qm", "initial");
    const base = await git(root, "rev-parse", "HEAD");

    await writeFile(path.join(root, "subject.ts"), "export const answer = 2;");
    await git(root, "add", "--", "subject.ts");
    await git(root, "commit", "-qm", "agent change");
    await mkdir(path.join(root, ".browser-profile"));
    await writeFile(
      path.join(root, ".browser-profile", "extension.js"),
      "export const generated = 1;",
    );
    const sources = await contents(root, base);

    assert.equal(sources["subject.ts"], "export const answer = 2;");
    assert.equal(Object.keys(sources).length, 1);
    assert.deepEqual(await contents(root), {});
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
