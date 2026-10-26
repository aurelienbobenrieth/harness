import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tasks } from "./tasks.mjs";
import { workspace, overlay, hiddenTests, check } from "./workspace.mjs";

const dir = path.resolve(process.argv[2]);
const repository =
  process.env.KEEPCART_REPOSITORY ?? "C:/Users/aurel/Documents/root/projects/keepcart/app";
const donor =
  process.env.KEEPCART_DEPENDENCIES ??
  "C:/Users/aurel/.t3/worktrees/app/v2-t-N-orchestrator-2026-10-25";
const rows = [];

for (const file of await readdir(dir)) {
  if (!/-(none|full|testing|build)-[12]\.json$/.test(file)) continue;
  rows.push({ file, row: JSON.parse(await readFile(path.join(dir, file), "utf8")) });
}

if (!rows.length) throw new Error("No trials to verify");

for (const [taskId, entries] of Map.groupBy(rows, (entry) => entry.row.task)) {
  const retry = entries.filter(
    ({ row }) =>
      ((!row.acceptance || !row.lint || row.acceptance?.killed || row.lint?.killed) &&
        !row.verificationRetry) ||
      (taskId === "uninstalled-regression" && row.acceptanceVersion !== 2),
  );

  if (!retry.length) continue;
  const task = tasks.find((item) => item.id === taskId);
  const hidden = await hiddenTests(repository, task);
  const trial = await workspace({ repository, donor, task, condition: "none" });

  try {
    for (const { file, row } of retry) {
      const diff = (row.diff ?? "").split("\n");
      const deleted = diff.flatMap((line, index) =>
        line === "+++ /dev/null" && diff[index - 1]?.startsWith("--- a/")
          ? [diff[index - 1].slice(6)]
          : [],
      );
      const sources = {
        ...row.sources,
        ...Object.fromEntries(deleted.map((name) => [name, null])),
      };

      row.verificationRetry = {
        acceptance: row.acceptance,
        lint: row.lint,
        reason:
          "one serialized verification after an outer process deadline or missing check; previous results retained",
      };

      await overlay(trial.cwd, sources, async () => {
        if (!row.acceptance || row.acceptance?.killed || taskId === "uninstalled-regression")
          row.acceptance = await overlay(trial.cwd, hidden, () =>
            check(
              trial.cwd,
              "test",
              task.tests.filter((name) => !name.endsWith("testing.tsx")),
              480000,
            ),
          );
        if (taskId === "uninstalled-regression") row.acceptanceVersion = 2;
        if (!row.lint || row.lint?.killed)
          row.lint = await check(trial.cwd, "lint", Object.keys(row.sources), 300000);
      });

      await writeFile(path.join(dir, file), JSON.stringify(row, null, 2));
      console.log(`${row.id}: acceptance=${row.acceptance?.pass} lint=${row.lint?.pass}`);
    }
  } finally {
    await trial.cleanup();
  }
}
