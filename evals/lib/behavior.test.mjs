import test from "node:test";
import assert from "node:assert/strict";
import { fixture, skills } from "./io.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { grade, reviewMetrics } from "../quality/grade.mjs";
test("no-skills control omits routing and always-on context", async () => {
  const f = await fixture("tiny", "none");
  try {
    assert.equal(await readFile(path.join(f.cwd, "AGENTS.md"), "utf8"), "# Fixture instructions\n");
    assert.deepEqual(await skills("none"), []);
  } finally {
    await f.cleanup();
  }
});
test("review recall penalizes misses and precision penalizes harmless findings", () => {
  const m = reviewMetrics([{ line: 2 }, { line: 3 }, { line: 9 }], [2, 3, 4, 5, 6]);
  assert.equal(m.recall, 0.4);
  assert.equal(m.precision, 2 / 3);
});
test("a claimed red test without observed failure cannot pass", () => {
  assert.equal(
    grade("testing", { events: [], toolCalls: [], messages: [{ content: "I wrote a failing test first" }] }, {}).pass,
    false,
  );
});
test("wait polling fails economy even when command eventually passed", () => {
  assert.equal(
    grade(
      "long",
      {
        toolCalls: [
          { name: "Bash", arguments: { command: "node slow.mjs", timeout: 60000 } },
          { name: "sleep", arguments: {} },
        ],
        messages: [],
      },
      {},
    ).pass,
    false,
  );
});

test("test-first requires assertion red on original source and unchanged tests on green", () => {
  const original = "old";
  const testSource = "assert.equal(discount(100,20),80)";
  const artifacts = {
    original,
    fixed: true,
    journal: [
      { scope: "scoped", source: original, test: testSource, status: 1, output: "ERR_ASSERTION" },
      { scope: "scoped", source: "fixed", test: testSource, status: 0, output: "" },
      { scope: "full", source: "fixed", test: testSource, status: 0, output: "" },
    ],
  };
  assert.equal(grade("testing", {}, artifacts).pass, true);
  assert.equal(grade("scoped", {}, artifacts).pass, true);
  assert.equal(grade("testing", {}, { ...artifacts, journal: [...artifacts.journal].toReversed() }).pass, false);
  assert.equal(
    grade("scoped", {}, { ...artifacts, journal: [...artifacts.journal, artifacts.journal[2]] }).pass,
    false,
  );
});
test("git refs install the requested immutable source, not working-tree skill bodies", async () => {
  const f = await fixture("tiny", "HEAD");
  try {
    assert.ok((await readFile(path.join(f.cwd, ".agents/skills/git/SKILL.md"), "utf8")).includes("name: git"));
  } finally {
    await f.cleanup();
  }
});

test("a failing final gate cannot certify scoped validation", () => {
  const testSource = "assert.equal(discount(100,20),80)";
  const journal = [
    { scope: "scoped", source: "old", test: testSource, status: 1, output: "ERR_ASSERTION" },
    { scope: "scoped", source: "fixed", test: testSource, status: 0, output: "" },
    { scope: "full", source: "fixed", test: testSource, status: 1, output: "ERR_ASSERTION" },
  ];
  assert.equal(grade("scoped", {}, { original: "old", fixed: true, journal }).pass, false);
});

test("economy scoped checks do not accidentally grade the separate red-first requirement", () => {
  assert.equal(
    grade(
      "scoped",
      {},
      {
        fixed: true,
        journal: [
          { scope: "scoped", status: 0 },
          { scope: "full", status: 0 },
        ],
      },
    ).pass,
    true,
  );
  assert.equal(grade("tiny", { toolCalls: [] }, { "title.txt": "Arithmetic\r\n" }).pass, true);
});
