import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { isSource, verificationPlan, mutationGate } from "./gates.mjs";

test("runtime artifacts never enter lint, including a nested browser profile", () => {
  for (const file of [
    ".browser-profile/a.js",
    "apps/ops/src/browser-profile/Default/a.js",
    "test-results/a.js",
    ".cache/a.ts",
    ".agents/tools/check.mjs",
  ])
    assert.equal(isSource(file), false, file);
  assert.equal(isSource("src/browser.ts"), true);
  assert.equal(isSource("src/result.test.ts"), true);
});

test("union producer edits include touched and unchanged consumers, reexports and their existing suites", () => {
  const sources = {
    "src/result.ts": 'export type Result = { kind: "forwarded" } | { kind: "reply" };',
    "src/api.ts": 'export { type Result } from "./result.js";',
    "src/handler.ts": 'import { type Result } from "./api"; const neutralReply: Result = {};',
    "src/handler.test.ts": 'import "./handler";',
    "src/other.ts": "export const unrelated = 1;",
  };
  const plan = verificationPlan(sources, ["src/result.ts"]);
  assert.deepEqual(plan.lint, [
    "src/api.ts",
    "src/handler.test.ts",
    "src/handler.ts",
    "src/result.ts",
  ]);
  assert.deepEqual(plan.tests, ["src/handler.test.ts"]);
  assert.deepEqual(verificationPlan(sources, ["src/other.ts"]).tests, []);
});

test("moved behavior mutation is killed by an unchanged consumer suite and restored", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "delta-mutation-"));
  const sources = {
    "authority.ts": "export function authority() { return true; }",
    "write.ts": 'import { authority } from "./authority";',
    "write.test.ts": 'import "./write";',
    "pause.test.ts": "// changed suite does not observe authority",
  };
  await writeFile(path.join(cwd, "authority.ts"), sources["authority.ts"]);
  const run = async (_, mode, tests) => {
    const changed = (await readFile(path.join(cwd, "authority.ts"), "utf8")).includes(
      "return false",
    );
    return {
      pass: !changed || !tests.includes("write.test.ts"),
      output: changed && tests.includes("write.test.ts") ? "Tests 1 failed" : "Tests 1 passed",
    };
  };
  try {
    const baseline = await mutationGate({
      cwd,
      sources,
      plan: { tests: ["pause.test.ts"], production: ["authority.ts"] },
      run,
    });
    assert.equal(baseline.results[0].status, "survived");
    const plan = verificationPlan(sources, ["authority.ts", "pause.test.ts"]);
    const delta = await mutationGate({ cwd, sources, plan, run });
    assert.equal(delta.results[0].status, "killed");
    assert.equal(await readFile(path.join(cwd, "authority.ts"), "utf8"), sources["authority.ts"]);
    const empty = await mutationGate({ cwd, sources, plan: { ...plan, tests: [] }, run });
    assert.equal(empty.status, "invalid-baseline");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
