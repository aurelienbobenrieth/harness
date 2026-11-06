import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { measure } from "../craft/measure.mjs";
import { tasks } from "../craft/tasks.mjs";

async function solved(task, source, testSource) {
  const cwd = await mkdtemp(path.join(tmpdir(), "harness-craft-test-"));
  try {
    const written = {
      ...task.files,
      [task.module]: source,
      ...(testSource ? { "test/spec.test.mjs": testSource } : {}),
    };
    for (const [file, text] of Object.entries(written)) {
      await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
      await writeFile(path.join(cwd, file), text);
    }
    return await measure(task, cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

for (const task of tasks.filter((item) => item.integrated)) {
  test(`${task.id}: the reference passes acceptance by reusing what exists, and the untouched app fails`, async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "harness-craft-test-"));
    try {
      for (const [file, text] of Object.entries({ ...task.files, ...task.reference })) {
        await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
        await writeFile(path.join(cwd, file), text);
      }
      const { metrics } = await measure(task, cwd);
      assert.equal(metrics.accepted, true);
      assert.equal(metrics.reused, true);
      for (const [file, text] of Object.entries(task.files)) await writeFile(path.join(cwd, file), text);
      assert.equal((await measure(task, cwd)).metrics.accepted, false);
    } finally {
      await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
}

for (const task of tasks.filter((item) => !item.integrated)) {
  test(`${task.id}: the reference passes acceptance, and its tests kill every mutant`, async () => {
    const { metrics } = await solved(task, task.reference, task.referenceTest);
    assert.equal(metrics.accepted, true);
    assert.equal(metrics.refactorSafe, true);
    assert.equal(metrics.mutation, 1);
  });

  test(`${task.id}: an empty module fails acceptance and earns no test credit`, async () => {
    const { metrics } = await solved(task, "export {};\n");
    assert.equal(metrics.accepted, false);
    assert.equal(metrics.mutation, 0);
  });
}

test("a test leaning on a private helper is not refactor safe", async () => {
  const task = tasks[0];
  const locked = `import test from "node:test";
import assert from "node:assert/strict";
import { totalOf } from "../src/coupon.mjs";
test("private helper", () => assert.equal(totalOf({ lines: [] }), 0));
`;
  const { metrics } = await solved(task, task.reference.replace("const totalOf", "export const totalOf"), locked);
  assert.equal(metrics.refactorSafe, false);
});

test("a tautology passes but kills nothing", async () => {
  const task = tasks[0];
  const empty = `import test from "node:test";
import assert from "node:assert/strict";
import { applyCoupon } from "../src/coupon.mjs";
test("exists", () => assert.equal(typeof applyCoupon, "function"));
`;
  const { metrics } = await solved(task, task.reference, empty);
  assert.equal(metrics.refactorSafe, true);
  assert.equal(metrics.mutation, 0);
});
