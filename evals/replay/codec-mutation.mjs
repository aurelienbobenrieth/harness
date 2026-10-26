import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tasks } from "./tasks.mjs";
import { workspace, overlay, check } from "./workspace.mjs";
import { codecFrameMutant, mutantStatus } from "./grade.mjs";

const dir = path.resolve(process.argv[2]);
const repository = process.env.KEEPCART_REPOSITORY ?? "C:/Users/aurel/Documents/root/projects/keepcart/app";
const donor = process.env.KEEPCART_DEPENDENCIES ?? "C:/Users/aurel/.t3/worktrees/app/v2-t-N-orchestrator-2026-10-25";
const task = tasks.find((item) => item.id === "archive-codec");
const production = task.scope[0];

const pending = [];
let recorded = 0;

for (const file of await readdir(dir)) {
  if (!/^archive-codec-.*-(none|full|testing|build)-[12]\.json$/.test(file)) continue;
  const row = JSON.parse(await readFile(path.join(dir, file), "utf8"));

  recorded++;
  if (!row.semanticMutation) pending.push({ file, row });
}

if (!recorded) throw new Error("No codec trials to grade");

if (pending.length) {
  const trial = await workspace({ repository, donor, task, condition: "none" });

  try {
    for (const { file, row } of pending) {
      const changed = row.sources?.[production] ? codecFrameMutant(production, row.sources[production]) : null;

      if (!changed || !row.agentTests?.length) {
        row.semanticMutation = { status: "skipped", reason: "no codec arrow or agent tests" };
      } else {
        row.semanticMutation = await overlay(trial.cwd, row.sources, async () => {
          const baseline = await check(trial.cwd, "test", row.agentTests);

          if (!baseline.pass) return { status: "invalid-baseline", baseline };
          const mutant = await overlay(trial.cwd, { [production]: changed }, () =>
            check(trial.cwd, "test", row.agentTests),
          );

          return { status: mutantStatus(mutant), baseline, mutant, name: "concatenated-valid-zstd-frames" };
        });
      }

      await writeFile(path.join(dir, file), JSON.stringify(row, null, 2));
      console.log(`${row.id}: ${row.semanticMutation.status}`);
    }
  } finally {
    await trial.cleanup();
  }
}
