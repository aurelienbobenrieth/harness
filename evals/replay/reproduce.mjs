import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tasks } from "./tasks.mjs";
import { workspace, overlay, check } from "./workspace.mjs";
import { verificationPlan, loadSources } from "./gates.mjs";
import { mutantStatus } from "./grade.mjs";

const input = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3] ?? "evals/results/replay/reproduced.json");

if (input === output) throw new Error("Baseline is read-only: choose a distinct output");
const row = JSON.parse(await readFile(input, "utf8"));
const task = tasks.find((entry) => entry.id === row.task);

if (!task || !row.mutation?.results?.length) throw new Error("No saved mutation sites");
const trial = await workspace({
  repository: process.env.KEEPCART_REPOSITORY ?? "C:/Users/aurel/Documents/root/projects/keepcart/app",
  donor: process.env.KEEPCART_DEPENDENCIES ?? "C:/Users/aurel/.t3/worktrees/app/v2-t-N-orchestrator-2026-10-25",
  task,
  condition: "none",
});

try {
  await overlay(trial.cwd, row.sources, async () => {
    const plan = verificationPlan(await loadSources(trial.cwd), Object.keys(row.sources));
    const baseline = await check(trial.cwd, "test", plan.tests);
    const results = [];

    for (const site of baseline.pass ? row.mutation.results : []) {
      const source = row.sources[site.file];

      if (!source?.includes(site.original)) throw new Error(`Stale mutation site: ${site.file}:${site.line}`);
      const outcome = await overlay(trial.cwd, { [site.file]: source.replace(site.original, site.replacement) }, () =>
        check(trial.cwd, "test", plan.tests),
      );

      results.push({
        ...site,
        originalStatus: site.status,
        status: mutantStatus(outcome),
        outcome,
      });
    }

    await mkdir(path.dirname(output), { recursive: true });

    await writeFile(output, JSON.stringify({ input, original: row.mutation, plan, baseline, results }, null, 2), {
      flag: "wx",
    });

    console.log(
      JSON.stringify({
        baseline: baseline.pass,
        suites: plan.tests,
        results: results.map(({ status, originalStatus }) => ({ status, originalStatus })),
      }),
    );

    if (!baseline.pass || results.some(({ status }) => status !== "killed")) process.exitCode = 1;
  });
} finally {
  await trial.cleanup();
}
