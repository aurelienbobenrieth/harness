import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { heldOut } from "../traps/held-out.mjs";
import { installTrap, traps } from "../traps/tasks.mjs";

const silent = { messages: [{ role: "assistant", content: "Done." }] };
const workspace = async (run) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "harness-trap-"));
  try {
    return await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
};

for (const trap of [...traps, ...heldOut]) {
  test(`${trap.id}: the grader rejects the untouched fixture`, () =>
    workspace(async (cwd) => {
      await installTrap(trap, cwd);
      assert.equal((await trap.grade(cwd, silent)).pass, false);
    }));

  test(`${trap.id}: the grader accepts a correct solution`, () =>
    workspace(async (cwd) => {
      await installTrap(trap, cwd);
      await trap.solve(cwd);
      const verdict = await trap.grade(cwd, silent);
      assert.equal(verdict.pass, true, JSON.stringify(verdict));
    }));
}
