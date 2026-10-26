import test from "node:test";
import assert from "node:assert/strict";
import { matrix, tasks } from "./tasks.mjs";
import { mutants, sourceSignals, validateJudgment, shellBoundary } from "./grade.mjs";

test("60 balanced cells, two repeats; luna has no ablations", () => {
  const cells = matrix();

  assert.equal(cells.length, 60);
  assert.equal(new Set(cells.map((c) => `${c.task.id}/${c.seed}/${c.model}/${c.condition}`)).size, 60);
  assert.equal(cells.filter((c) => c.model === "gpt-6-luna").length, 20);
  assert.equal(tasks.filter((t) => t.pbt).length, 1);
});

test("AST mutants exclude strings/comments and include operator, boundary and return", () => {
  const source =
    'const text = "a > b"; // return true\nexport const f = (x:number) => { if (x > 25) return true; return false; };';
  const result = mutants("sample.ts", source);

  assert.ok(result.some((m) => m.kind === "operator" && m.source.includes("x >= 25")));
  assert.ok(result.some((m) => m.kind === "boundary" && m.source.includes("x > 26")));
  assert.ok(result.some((m) => m.kind === "return" && m.source.includes("return false; return false")));
  assert.ok(result.every((m) => m.source.includes('"a > b"; // return true')));
});

test("tautology and boundary signals cite lines; independent literal stays silent", () => {
  const sources = {
    "feature/_/domain/f.ts": 'import { db } from "@keepcart/persistence";\nexport const f = () => 2;',
    "feature/f.test.ts": 'import { f } from "./_/domain/f.ts";\nexpect(f()).toBe(f());\nvi.mock("./_/domain/f.ts");',
  };
  const signals = sourceSignals(sources);

  assert.equal(signals.infrastructure.length, 1);
  assert.equal(signals.tautology.length, 2);
  assert.equal(signals.tautology[0].line, 2);
  assert.equal(sourceSignals({ "f.test.ts": 'import { f } from "./f.ts";\nexpect(f()).toBe(2);' }).tautology.length, 0);
});

test("judge rejects absent citations, invalid scores and nonexistent paths", () => {
  const criteria = ["isolation", "abstraction", "tests", "fit"];
  const valid = Object.fromEntries(
    criteria.map((k) => [k, { score: 2, file: "a.ts", line: 1, quote: "return 2", reason: "observed" }]),
  );

  assert.equal(validateJudgment(valid, { "a.ts": "return 2" }), true);
  assert.equal(validateJudgment({ ...valid, tests: { score: 4 } }, { "a.ts": "return 2" }), false);
  assert.equal(validateJudgment(valid, { "b.ts": "return 2" }), false);
});

test("shell boundary catches an unchanged leak, while allowing the public api", () => {
  assert.equal(
    shellBoundary({
      "apps/ops/src/shell/nav.tsx": 'import { tabs } from "../features/jobs/tabs.ts";',
    }),
    false,
  );

  assert.equal(
    shellBoundary({
      "apps/ops/src/shell/nav.tsx": 'import { tabs } from "../features/jobs/api.ts";',
    }),
    true,
  );
});
