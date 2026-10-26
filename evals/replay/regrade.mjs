import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { git } from "./workspace.mjs";
import { shellBoundary, validateJudgment, mutantStatus } from "./grade.mjs";

const dir = path.resolve(process.argv[2]);
const repository = process.env.KEEPCART_REPOSITORY ?? "C:/Users/aurel/Documents/root/projects/keepcart/app";
const paths = ["nav-counts.tsx", "nav.tsx", "navigation-commands.tsx", "preferences.ts"];

for (const file of await readdir(dir)) {
  if (!/-(?:none|full|testing|build)-[12]\.json$/.test(file)) continue;
  const row = JSON.parse(await readFile(path.join(dir, file), "utf8"));

  if (row.task === "shell-boundaries") {
    const whole = {};

    for (const name of paths) {
      const target = `apps/ops/src/shell/${name}`;

      whole[target] = row.sources?.[target] ?? (await git(repository, "show", `${row.base}:${target}`));
    }

    row.boundary = shellBoundary(whole);
    row.boundarySources = whole;
  }

  if (row.judgment?.value) row.judgment.valid = validateJudgment(row.judgment.value, row.sources ?? {});

  if (row.mutation?.results) {
    for (const result of row.mutation.results)
      result.status = mutantStatus({
        pass: result.status === "survived",
        killed: result.status === "timeout",
        output: result.output,
      });
    row.mutation.killed = row.mutation.results.filter((result) => result.status === "killed").length;
    row.mutation.valid = row.mutation.results.filter((result) => ["killed", "survived"].includes(result.status)).length;
    row.mutation.score = row.mutation.valid ? row.mutation.killed / row.mutation.valid : null;
    row.mutation.status = row.mutation.valid ? "measured" : "no-valid-mutants";
  }

  row.pass =
    row.run?.status === "completed" &&
    Boolean(row.acceptance?.pass) &&
    Boolean(row.lint?.pass) &&
    row.boundary !== false;

  row.graderRevision = 3;
  await writeFile(path.join(dir, file), JSON.stringify(row, null, 2));
}
