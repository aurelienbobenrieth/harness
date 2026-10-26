import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFixture, command, git } from "../code-shape/fixture.mjs";
import { metrics } from "../code-shape/metrics.mjs";
import { acceptance } from "../code-shape/acceptance.mjs";
import { ruleNames, validateJudgment } from "../code-shape/grade.mjs";
import { summarize } from "../code-shape/report.mjs";

test("fixture starts green and independent regression oracle rejects its seeded bug", async () => {
  const fixture = await createFixture("none");
  try {
    assert.equal(command(fixture.cwd, process.execPath, ["check.mjs", "full"]).status, 0);
    await writeFile(path.join(fixture.cwd, ".acceptance.test.ts"), acceptance.regression);
    const red = command(fixture.cwd, process.execPath, ["--test", ".acceptance.test.ts"]);
    assert.equal(red.status, 1);
    assert.match(red.stdout, /1600|ERR_ASSERTION/u);
    const file = path.join(fixture.cwd, "src/pricing.ts");
    await writeFile(
      file,
      (await readFile(file, "utf8")).replace("cents * percent", "cents * (100 - percent)"),
    );
    assert.equal(
      command(fixture.cwd, process.execPath, ["--test", ".acceptance.test.ts"]).status,
      0,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("real graders detect baseline duplication and a new dead export and count added files", async () => {
  const fixture = await createFixture("none");
  try {
    const base = git(fixture.cwd, "rev-parse", "HEAD");
    const before = await metrics(fixture.cwd, base);
    assert.equal(before.testsPass, true);
    assert.ok(before.duplicatedLines > 0);
    assert.ok(before.findings > 0);
    assert.ok(before.cyclomaticTotal > 0);
    await writeFile(path.join(fixture.cwd, "src/unused.ts"), "export const unused = 42;\n");
    await writeFile(
      path.join(fixture.cwd, "src/pricing.ts"),
      (await readFile(path.join(fixture.cwd, "src/pricing.ts"), "utf8")) +
        "\nexport const unusedExport = 42;\n",
    );
    git(fixture.cwd, "add", "-N", "--", "src");
    const after = await metrics(fixture.cwd, base);
    assert.ok(after.deadExports > before.deadExports);
    assert.equal(after.added, 3);
  } finally {
    await fixture.cleanup();
  }
});

test("judge refuses missing, duplicate or nonexistent line citations", () => {
  const final = { "src/api.ts": "const value = 1;\n" };
  const value = {
    rules: ruleNames.map((rule) => ({
      rule,
      score: 2,
      file: "src/api.ts",
      line: 1,
      reason: "evidence",
    })),
  };
  assert.equal(validateJudgment(value, final), value);
  assert.throws(() => validateJudgment({ rules: [] }, final), /Missing/u);
  assert.throws(
    () => validateJudgment({ rules: value.rules.map((rule) => ({ ...rule, line: 99 })) }, final),
    /Invalid/u,
  );
  assert.throws(
    () => validateJudgment({ rules: value.rules.map(() => value.rules[0]) }, final),
    /Invalid/u,
  );
});

test("summary includes cache and censored failures, never turns missing judges into zero", () => {
  const result = summarize([
    {
      suite: "shape",
      provider: "claude",
      condition: "none",
      seed: 1,
      id: "regression",
      grade: { pass: false },
      usd: 0.1,
      run: {
        status: "budget",
        tokens: { input: 10, output: 20, cached: 30, cacheWrite5m: 40, cacheWrite1h: 50 },
        toolCalls: [{}],
      },
    },
  ]);
  assert.equal(result.conditions[0].passRate, 0);
  assert.equal(result.conditions[0].tokens, 150);
  assert.equal(result.conditions[0].cacheTokens, 120);
  assert.equal(result.conditions[0].scores.boundaries, null);
});
