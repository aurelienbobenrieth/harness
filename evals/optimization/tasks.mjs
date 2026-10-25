import { readFile, writeFile, readdir } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { answer, grade } from "../quality/grade.mjs";
import { tasks as economy } from "../economy/tasks.mjs";
import { tasks as quality } from "../quality/tasks.mjs";

const read = (cwd, file) => readFile(path.join(cwd, file), "utf8");
const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
export const noCredit = (text) =>
  !/co-authored-by|generated (?:with|by)|claude|anthropic|openai|chatgpt|\bgpt[- ]|\bmodel credits?\b/i.test(
    text,
  );
const check = (checks) => ({ pass: Object.values(checks).every(Boolean), checks });
const alias = (id, skill, base, prompt, extra = {}) => ({ id, skill, base, prompt, ...extra });
const base = (id) => [...economy, ...quality].find((t) => t.id === id);
const gitGrade = (run, a) => {
  const result = grade("git", run, a);
  return check({ ...result.checks, noCredit: noCredit(a["commit.txt"] + a["pr.txt"]) });
};
const inspectComm = (run) =>
  (run.messages ?? [])
    .filter((m) => m.role === "assistant")
    .flatMap((m) =>
      typeof m.content === "string"
        ? [m.content]
        : (m.content ?? []).filter((b) => b.type === "text").map((b) => b.text),
    )
    .filter(Boolean);
export function communicationGrade(id, run) {
  const text = answer(run).trim(),
    first = text.split(/\r?\n/)[0],
    blocks = inspectComm(run);
  const plain = !/synerg|leverage|paradigm|delve|utiliz|orchestrat|—|I'd be happy|Certainly!/i.test(
    text,
  );
  if (id === "comm-status")
    return check({
      nonempty: !!text,
      bounded: blocks.every((b) => b.trim().split(/\r?\n/).length <= 3 && b.length <= 450),
      answerFirst: /2.*(?:8|10)|8.*(?:2|10)/.test(first),
      plain,
    });
  if (id === "comm-plain")
    return check({
      nonempty: !!text,
      bounded: text.length <= 500,
      plain,
      noDump: !/```|calc\.mjs|adapter-\d|node_modules/.test(text),
      consequence: /wait|slow|later|delay|second/i.test(text),
    });
  if (id === "comm-answer")
    return check({
      answerFirst: /^(?:\*\*)?No\b/i.test(first),
      bounded: text.length <= 450,
      plain,
    });
  return check({
    french:
      /(?:reste|encore|vérification|tests?|échec|échou|réussi|passent)/i.test(first) &&
      !/\b(?:the|passed|remaining|failed|tests pass)\b/i.test(text),
    bounded: text.length <= 450,
    answerFirst: /2|deux/i.test(first),
    plain,
  });
}
const testInspect = async (cwd, run, a) => {
  a.testSource = await read(cwd, "calc.test.mjs").catch(() => "");
  const result = spawnSync(process.execPath, ["--test", "calc.test.mjs"], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
  a.independentTest = result.status === 0 && /# tests [1-9]/.test(result.stdout);
  a.finalSource = await read(cwd, "calc.mjs");
};
export function testGrade(run, a) {
  return check({
    working: a.independentTest,
    publicBoundary: /(?:import|require)[\s\S]*calc\.mjs/.test(a.testSource),
    meaningful: /assert\.(?:equal|deepEqual|strictEqual|throws|rejects)/.test(a.testSource),
    deterministic: !/setTimeout|sleep|Math\.random|Date\.now/.test(a.testSource),
    independent: !/assert\.(?:equal|deepEqual)\(\s*discount\([^)]*\)\s*,\s*discount/.test(
      a.testSource,
    ),
  });
}
export const tasks = [
  alias(
    "git-mixed",
    "git",
    "git",
    base("git").prompt +
      " README.md also has an unrelated spelling correction. Keep the bug fix and its regression together; write its message only.",
    {
      prepare: (cwd) => writeFile(path.join(cwd, "README.md"), "Arithmetic examples\n"),
      grade: gitGrade,
    },
  ),
  alias(
    "git-pr",
    "git",
    "git",
    "Write commit.txt and pr.txt for the staged discount fix and regression in this fixture. This is a multi-file change. Describe the user-visible result; no publishing or committing.",
    { grade: gitGrade },
  ),
  alias(
    "git-split",
    "git",
    "git",
    "Commit the discount fix with its regression, and the unrelated README spelling correction as separate local commits. Do not push.",
    {
      prepare: (cwd) => writeFile(path.join(cwd, "README.md"), "Arithmetic examples\n"),
      inspect: async (cwd, run, a) => {
        a.messages = git(cwd, "log", "-2", "--format=%B");
        a.commits = git(cwd, "log", "-2", "--format=", "--name-only")
          .split(/\r?\n/)
          .filter(Boolean);
        a.groups = git(cwd, "log", "-2", "--format=COMMIT", "--name-only")
          .split("COMMIT")
          .map((s) => s.trim())
          .filter(Boolean);
      },
      grade: (run, a) =>
        check({
          separate:
            a.groups.length === 2 &&
            a.groups.some(
              (g) =>
                g.includes("calc.mjs") && g.includes("calc.test.mjs") && !g.includes("README.md"),
            ) &&
            a.groups.some((g) => g === "README.md"),
          noCredit: noCredit(a.messages),
        }),
    },
  ),
  alias(
    "git-credit",
    "git",
    "git",
    "Commit the discount fix and its regression locally. Do not push.",
    {
      inspect: async (cwd, run, a) => {
        a.message = git(cwd, "log", "-1", "--format=%B");
        a.names = git(cwd, "show", "--format=", "--name-only", "HEAD");
      },
      grade: (run, a) =>
        check({
          committed: a.names.includes("calc.test.mjs"),
          conventional: /^fix(?:\([\w-]+\))?: /.test(a.message),
          noCredit: noCredit(a.message),
        }),
    },
  ),
  ...[
    [
      "comm-status",
      "Give the current status update: 8 of 10 checks passed; two failed on missing credentials; no code failure was observed.",
    ],
    [
      "comm-plain",
      "Explain to a shop owner why queue latency rose from 1 to 8 seconds after a traffic spike. The workers process orders at the same rate as before.",
    ],
    [
      "comm-answer",
      "Can we say CI passed? All local checks passed, but CI has not run. Explain your decision.",
    ],
    [
      "comm-fr",
      "Où en est-on ? Huit vérifications sur dix passent ; deux échouent faute d’identifiants. Aucun défaut du code observé.",
    ],
  ].map(([id, prompt]) => ({
    id,
    skill: "communication",
    prompt,
    grade: (run) => communicationGrade(id, run),
  })),
  alias(
    "build-implement",
    "build",
    "scoped",
    "Implement the discount correction: discount(100,20) must return remaining price 80. Add regression coverage. Commands: node check.mjs scoped and node check.mjs full. Verify before handing off.",
  ),
  alias(
    "build-feature",
    "build",
    "testing",
    "Add a feature: discount must return the remaining price, so discount(50,10) is 45. Use node:test in calc.test.mjs. Commands: node check.mjs scoped and node check.mjs full.",
  ),
  {
    id: "build-design",
    skill: "build",
    prompt:
      "Implement a receipt writer in receipt.mjs. Public API writeReceipt(path, text) writes UTF-8 text to a file. Callers must not need init/configure/open calls first. This is the only requested feature. Add receipt.test.mjs using node:test and verify it. No dependencies.",
    inspect: async (cwd, run, a) => {
      a.receipt = await read(cwd, "receipt.mjs").catch(() => "");
      a.receiptTest = await read(cwd, "receipt.test.mjs").catch(() => "");
      const target = path.join(cwd, "receipt-proof.txt");
      const r = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import {writeReceipt} from './receipt.mjs';import {readFile} from 'node:fs/promises';await writeReceipt(${JSON.stringify(target)},'paid');if(await readFile(${JSON.stringify(target)},'utf8')!=='paid')process.exit(1)`,
        ],
        { cwd, timeout: 5000 },
      );
      a.wrote = r.status === 0;
      a.exports = [
        ...a.receipt.matchAll(/export\s+(?:(?:async\s+)?function|const|class)\s+(\w+)/g),
      ].map((m) => m[1]);
    },
    grade: (run, a) =>
      check({
        temporalCoupling: a.wrote,
        abstractionEarnsKeep:
          a.exports.length === 1 && a.exports[0] === "writeReceipt" && !/\bclass\b/.test(a.receipt),
        boundaryTest:
          /receipt\.mjs/.test(a.receiptTest) &&
          /readFile/.test(a.receiptTest) &&
          /assert/.test(a.receiptTest),
      }),
  },
  alias(
    "build-scope",
    "build",
    "tiny",
    "Fix Arthmetic to Arithmetic in title.txt. This spelling correction is the entire feature request.",
    {
      inspect: async (cwd, run, a) => {
        a.extra = (await readdir(cwd)).filter(
          (n) =>
            ![
              ".agents",
              ".claude",
              "AGENTS.md",
              "CLAUDE.md",
              "adapters",
              "calc.mjs",
              "change.diff",
              "check.mjs",
              "delegate.mjs",
              "package.json",
              "proposed.mjs",
              "README.md",
              "slow.mjs",
              "title.txt",
            ].includes(n),
        );
      },
      grade: (run, a) =>
        check({
          fixed: a["title.txt"]?.trim() === "Arithmetic",
          noGoldPlating: a.extra.length === 0,
        }),
    },
  ),
  alias(
    "test-red",
    "testing",
    "testing",
    "Fix discount(100,20): expected remaining price 80, actual 20. Add tests with node:test in calc.test.mjs; node check.mjs scoped runs them. Verify the correction.",
  ),
  alias(
    "test-boundary",
    "testing",
    "testing",
    "Add tests for discount's public contract: remaining price is 80 for (100,20), 45 for (50,10), and 100 for (100,0). Correct any observed defect. Use node:test in calc.test.mjs; node check.mjs scoped runs it.",
    { inspect: testInspect, grade: testGrade },
  ),
  alias(
    "test-empty",
    "testing",
    "testing",
    "Improve calc.test.mjs so its green result proves the remaining-price contract: (100,20) returns 80 and (50,10) returns 45. Correct any exposed defect. Run node check.mjs scoped.",
    {
      prepare: (cwd) =>
        writeFile(
          path.join(cwd, "calc.test.mjs"),
          "import test from 'node:test';import assert from 'node:assert/strict';test('discount',()=>assert.ok(true));\n",
        ),
      inspect: testInspect,
      grade: (run, a) =>
        check({
          ...testGrade(run, a).checks,
          noEmptyAssertion: !/assert\.ok\(true\)/.test(a.testSource),
          cases: /80/.test(a.testSource) && /45/.test(a.testSource),
        }),
    },
  ),
  alias(
    "test-flaky",
    "testing",
    "testing",
    "Fix the flaky test in calc.test.mjs. It should verify the remaining-price contract for (100,20). Use deterministic scheduling and correct any actual implementation defect. Run node check.mjs scoped.",
    {
      prepare: (cwd) =>
        writeFile(
          path.join(cwd, "calc.test.mjs"),
          "import test from 'node:test';import assert from 'node:assert/strict';import {discount} from './calc.mjs';test('remaining price',async()=>{const started=Date.now();await new Promise(r=>setTimeout(r,10));assert.ok(Date.now()-started<15);assert.equal(discount(100,20),80)});\n",
        ),
      inspect: testInspect,
      grade: testGrade,
    },
  ),
  ...["scoped", "tiny", "broad", "owner"].map((id) =>
    alias(`economy-${id}`, "economy", id, base(id).prompt),
  ),
];
