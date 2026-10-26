import { mkdir, readFile, writeFile, appendFile, open, rm, rename } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { runAgent, judge, budget } from "../lib/runner.mjs";
import { options, root, skillsRevision } from "../lib/io.mjs";
import { tasks, matrix } from "./tasks.mjs";
import { sourceSignals, mutants, validateJudgment, shellBoundary } from "./grade.mjs";
import { workspace, command, git, contents, hiddenTests, overlay, check } from "./workspace.mjs";

const opts = options();

if (budget.limit > 25) throw new Error("Replay has a hard $25 ceiling");
const repository = path.resolve(
  opts.repository ?? process.env.KEEPCART_REPOSITORY ?? "C:/Users/aurel/Documents/root/projects/keepcart/app",
);
const donor = path.resolve(
  opts.donor ?? process.env.KEEPCART_DEPENDENCIES ?? "C:/Users/aurel/.t3/worktrees/app/v2-t-N-orchestrator-2026-10-25",
);
const output = path.join(root, "evals/results/replay", opts.id ?? "keepcart-v1");
const selected = tasks.filter((task) => !opts.tasks || opts.tasks.split(",").includes(task.id));

if (!selected.length) throw new Error("Empty task selection");
const ref = opts["skills-ref"] ?? "origin/steering/economy";
const revision = skillsRevision(ref);

await mkdir(output, { recursive: true });
const ledgerPath = path.join(output, "ledger.json");
const ledger = await readFile(ledgerPath, "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code !== "ENOENT") throw error;

    return {
      spent: Number(opts["prior-usd"] ?? 0),
      rows: [],
      priorUsd: Number(opts["prior-usd"] ?? 0),
    };
  });

budget.spent = ledger.spent;
let recording = Promise.resolve();
const recordSpend = () => {
  recording = recording.then(async () => {
    ledger.spent = budget.spent;
    await writeFile(ledgerPath + ".tmp", JSON.stringify(ledger, null, 2));
    await rename(ledgerPath + ".tmp", ledgerPath);
  });

  return recording;
};
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function reference(task) {
  const hidden = await hiddenTests(repository, task);
  const diff = await git(repository, "show", "--format=", task.commit, "--", ...task.scope);

  return { hidden, diff, hash: hash({ hidden, diff }) };
}

async function preflight(task) {
  const refData = await reference(task);
  const trial = await workspace({ repository, donor, task, condition: "none", ref });

  try {
    const baseline = await overlay(trial.cwd, refData.hidden, () =>
      check(
        trial.cwd,
        "test",
        task.tests.filter((p) => !p.endsWith("testing.tsx")),
      ),
    );
    const names = (
      await git(repository, "diff-tree", "--no-commit-id", "--name-only", "-r", task.commit, "--", ...task.scope)
    )
      .split(/\r?\n/)
      .filter(Boolean);
    const landed = {};
    const deleted = [];

    for (const name of names) {
      const read = await command("git", ["show", `${task.commit}:${name}`], repository);

      if (read.status === 0) landed[name] = read.output;
      else deleted.push(name);
    }

    const green = await overlay(trial.cwd, { ...landed, ...refData.hidden }, () =>
      check(
        trial.cwd,
        "test",
        task.tests.filter((p) => !p.endsWith("testing.tsx")),
      ),
    );

    return {
      id: task.id,
      base: trial.base,
      reference: refData.hash,
      baseline,
      green,
      deleted,
      valid: green.pass && (task.acceptanceKind === "existing-tests-and-boundary" || !baseline.pass),
    };
  } finally {
    await trial.cleanup();
  }
}

function changedLines(diff, sources) {
  const result = new Map();
  let file;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    const hunk = line.match(/^@@ .* \+(\d+)(?:,(\d+))? @@/);

    if (file && hunk) {
      const set = result.get(file) ?? new Set();
      const start = Number(hunk[1]),
        count = Number(hunk[2] ?? 1);

      for (let n = start; n < start + count; n++) set.add(n);
      result.set(file, set);
    }
  }

  for (const [name, value] of Object.entries(sources))
    if (!result.has(name)) result.set(name, new Set(value.split("\n").map((_, index) => index + 1)));

  return result;
}

async function mutation(trial, sources, testPaths, diff) {
  const baseline = await check(trial.cwd, "test", testPaths);

  if (!baseline.pass) return { status: "invalid-baseline", baseline, score: null, killed: 0, valid: 0 };
  const changed = changedLines(diff, sources);
  const eligible = Object.entries(sources).filter(
    ([file]) => !/(?:\.test\.|\/testing[./]|\/testing\.|\.config\.)/.test(file),
  );
  const all = eligible.flatMap(([file, source]) =>
    mutants(file, source)
      .filter((m) => changed.get(file)?.has(m.line))
      .map((m) => ({ file, ...m })),
  );
  // Stable stratification by kind and file, rather than mutating only the first file's constants.
  const groups = Map.groupBy(all, (m) => `${m.kind}/${m.file}`),
    sample = [];

  for (let index = 0; sample.length < Number(opts.mutants ?? 9); index++) {
    const next = [...groups.values()].map((group) => group[index]).filter(Boolean);

    if (!next.length) break;
    for (const item of next) if (sample.length < Number(opts.mutants ?? 9)) sample.push(item);
  }

  const results = [];

  for (const mutant of sample) {
    const outcome = await overlay(trial.cwd, { [mutant.file]: mutant.source }, () =>
      check(trial.cwd, "test", testPaths, 90000),
    );
    const assertion = /AssertionError|expected .*(?:to |but)|→ expected|❯.*expect\(/i.test(outcome.output ?? "");

    results.push({
      file: mutant.file,
      kind: mutant.kind,
      line: mutant.line,
      original: mutant.original,
      replacement: mutant.replacement,
      status: outcome.pass ? "survived" : outcome.killed ? "timeout" : assertion ? "killed" : "invalid",
      output: outcome.output?.slice(-6000),
    });
  }

  const killed = results.filter((m) => m.status === "killed").length;
  const valid = results.filter((m) => ["killed", "survived"].includes(m.status)).length;

  return {
    status: valid ? "measured" : "no-valid-mutants",
    available: all.length,
    sampled: results.length,
    results,
    killed,
    valid,
    score: valid ? killed / valid : null,
    baseline,
  };
}

async function runCell(cell) {
  const { task, seed, model, condition } = cell;
  const refData = await reference(task);
  const trial = await workspace({ repository, donor, task, condition, ref: revision });
  const id = `${task.id}-${model}-${condition}-${seed}`;
  const row = {
    id,
    task: task.id,
    model,
    condition,
    seed,
    skillsRevision: revision,
    referenceHash: refData.hash,
    pbtExpected: task.pbt,
    browserExpected: task.browser,
  };

  try {
    row.base = trial.base;
    row.exposure = trial.exposed;

    row.run = await runAgent({
      provider: "codex",
      model,
      reasoningEffort: "medium",
      cwd: trial.cwd,
      prompt: `${task.prompt}\nProduction scope: ${task.scope.join(", ")}. Tests alongside that scope are authorized and should be retained.\nWork independently and finish the implementation with meaningful scoped verification. Do not read git history, other worktrees, reference diffs, or hidden evaluation files. Do not push, install dependencies, deploy, or call other agents. Dependencies are prelinked. Trial seed ${seed}.`,
      writable: true,
      maxTurns: Number(opts.turns ?? 40),
      timeoutMs: Number(opts["timeout-ms"] ?? 480000),
      observe: (event) => {
        appendFileSync(path.join(output, `${id}.events.jsonl`), JSON.stringify(event) + "\n");
      },
      maxUsd: Number(opts["case-usd"] ?? 0.65),
    });

    await recordSpend();
    row.sources = await contents(trial.cwd);
    row.diff = await git(trial.cwd, "diff", "--no-ext-diff", "--unified=0", "HEAD", "--", ...task.scope);
    row.referenceDiff = refData.diff;
    const beforeSources = {};

    for (const file of Object.keys(row.sources)) {
      const before = await command("git", ["show", `HEAD:${file}`], trial.cwd);

      if (before.status === 0) beforeSources[file] = before.output;
    }

    row.signals = sourceSignals(row.sources);
    row.baselineSignals = sourceSignals(beforeSources);

    row.newExports = row.signals.exports.filter(
      (e) => !row.baselineSignals.exports.some((b) => b.file === e.file && b.name === e.name),
    );

    row.newInfrastructure = row.signals.infrastructure.filter(
      (e) => !row.baselineSignals.infrastructure.some((b) => b.file === e.file && b.quote === e.quote),
    );

    row.diffSize = {
      added: row.diff.split("\n").filter((l) => /^\+[^+]/.test(l)).length,
      removed: row.diff.split("\n").filter((l) => /^-[^-]/.test(l)).length,
      newFileLines: Object.keys(row.sources)
        .filter((file) => !(file in beforeSources))
        .reduce((n, file) => n + row.sources[file].split("\n").length, 0),
      referenceAdded: refData.diff.split("\n").filter((l) => /^\+[^+]/.test(l)).length,
    };

    const tests = Object.keys(row.sources).filter((file) => /\.test\.[jt]sx?$/.test(file));

    row.agentTests = tests;
    row.mutation = await mutation(trial, row.sources, tests, row.diff);
    row.lint = await check(trial.cwd, "lint", Object.keys(row.sources));

    row.acceptance = await overlay(trial.cwd, refData.hidden, () =>
      check(
        trial.cwd,
        "test",
        task.tests.filter((p) => !p.endsWith("testing.tsx")),
      ),
    );

    if (task.id === "shell-boundaries") {
      const shell = ["nav-counts.tsx", "nav.tsx", "navigation-commands.tsx", "preferences.ts"];

      row.boundarySources = Object.fromEntries(
        await Promise.all(
          shell.map(async (name) => {
            const file = `apps/ops/src/shell/${name}`;

            return [file, await readFile(path.join(trial.cwd, file), "utf8")];
          }),
        ),
      );

      row.boundary = shellBoundary(row.boundarySources);
    } else row.boundary = null;
    row.pass = row.run.status === "completed" && row.acceptance.pass && row.lint.pass && row.boundary !== false;

    try {
      const judgedSources = Object.fromEntries(
        Object.entries(row.sources).map(([file, text]) => [
          file,
          text
            .split("\n")
            .slice(0, 550)
            .map((line, i) => `${i + 1}: ${line}`)
            .join("\n"),
        ]),
      );
      const judgment = await judge({
        rubric:
          "Return {isolation,abstraction,tests,fit}; each value is {score:integer 0..3,file:string,line:integer,quote:string,reason:string}. Cite an exact source line without the line-number prefix. 0=violates or absent,1=weak,2=adequate,3=strong. Isolation: inward dependencies, no boundary leaks, appropriate fakes or real adapters. Abstraction: minimal useful public API and no speculative or single-use wrapper. Tests: independent behavior oracle, distinguishing regressions, no subject mocks. Fit: PBT for codec/invariant laws; no pointless PBT; browser evidence for UI changes. Reference is context, not an expected patch. Do not infer verification from prose or grant unavailable evidence. If no source evidence supports a criterion cite the relevant implementation line and explain the gap.",
        input: {
          brief: task.prompt,
          sources: judgedSources,
          reference: refData.diff.slice(0, 16000),
          mutation: row.mutation,
          acceptance: row.acceptance.pass,
          lint: row.lint.pass,
          toolEvidence: row.run.toolCalls,
          messages: row.run.messages.slice(-2),
          pbtExpected: task.pbt,
          browserExpected: task.browser,
        },
        maxUsd: Number(opts["judge-usd"] ?? 0.08),
        timeoutMs: 90000,
      });

      row.judgment = { ...judgment, valid: validateJudgment(judgment.value, row.sources) };
    } catch (error) {
      row.judgment = { valid: false, error: error.message, run: error.run };
    }

    await recordSpend();

    return row;
  } catch (error) {
    Object.assign(row, { pass: false, error: error.stack });

    return row;
  } finally {
    // Persist evidence before destroying the only trial checkout, including interrupted rows.
    await writeFile(path.join(output, `${id}.json`), JSON.stringify(row, null, 2));
    await trial.cleanup();
  }
}

if (opts.mode === "preflight") {
  for (const task of selected) {
    const result = await preflight(task);

    await writeFile(path.join(output, `preflight-${task.id}.json`), JSON.stringify(result, null, 2));

    console.log(
      JSON.stringify({
        task: task.id,
        valid: result.valid,
        baseline: result.baseline.pass,
        green: result.green.pass,
      }),
    );
  }
} else {
  const lock = await open(path.join(output, "run.lock"), "wx");

  await lock.writeFile(String(process.pid));

  try {
    const plan = matrix(selected).filter(
      (cell) =>
        (!opts.models || opts.models.split(",").includes(cell.model)) &&
        (!opts.conditions || opts.conditions.split(",").includes(cell.condition)) &&
        (!opts.seeds || opts.seeds.split(",").includes(String(cell.seed))),
    );

    if (!plan.length) throw new Error("Empty matrix selection");

    await writeFile(
      path.join(output, "plan.json"),
      JSON.stringify(
        {
          revision,
          repository,
          donor,
          cells: matrix().map(({ task, ...cell }) => ({ task: task.id, ...cell })),
        },
        null,
        2,
      ),
    );

    const queue = plan.filter(
      (cell) => !ledger.rows.includes(`${cell.task.id}-${cell.model}-${cell.condition}-${cell.seed}`),
    );
    let next = 0;
    const worker = async () => {
      for (;;) {
        const cell = queue[next++];

        if (!cell) return;
        const id = `${cell.task.id}-${cell.model}-${cell.condition}-${cell.seed}`;

        if (ledger.rows.includes(id)) continue;

        // Reserve the entire next agent + judge before touching a trial. Leave room for unmetered termination.
        if (
          budget.spent + budget.reserved + Number(opts["case-usd"] ?? 0.65) + Number(opts["judge-usd"] ?? 0.08) >
          budget.limit
        ) {
          await appendFile(
            path.join(output, "stopped.jsonl"),
            JSON.stringify({
              reason: "budget",
              next: id,
              spent: budget.spent,
              limit: budget.limit,
            }) + "\n",
          );

          console.log(`BUDGET STOP $${budget.spent.toFixed(4)}`);
          break;
        }

        const row = await runCell(cell);

        ledger.rows.push(id);
        await recordSpend();

        console.log(
          `${id}: ${row.run?.status ?? "error"} acceptance=${row.acceptance?.pass ?? false} lint=${row.lint?.pass ?? false} mutation=${row.mutation?.score ?? "NA"} $${budget.spent.toFixed(4)}`,
        );
      }
    };
    const concurrency = Number(opts.concurrency ?? 4);

    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
      throw new Error("Concurrency must be 1..4");
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    await lock.close();
    await rm(path.join(output, "run.lock"));
  }
}
