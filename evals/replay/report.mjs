import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { matrix } from "./tasks.mjs";

const mean = (values) =>
  values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;

export function summarize(rows) {
  return [...Map.groupBy(rows, (row) => `${row.model}/${row.condition}`)].map(
    ([condition, group]) => ({
      condition,
      n: group.length,
      planned: 10,
      complete: group.filter((r) => r.run?.status === "completed").length,
      pass: group.filter((r) => r.pass).length,
      acceptance: group.filter((r) => r.acceptance?.pass).length,
      acceptanceInvalid: group.filter(
        (r) => !r.acceptance || r.acceptance.killed || r.acceptance.status === "skipped",
      ).length,
      verificationRetries: group.filter((r) => r.verificationRetry).length,
      lint: group.filter((r) => r.lint?.pass).length,
      mutation: mean(
        group
          .filter((r) => r.mutation?.score !== null && r.mutation?.score !== undefined)
          .map((r) => r.mutation.score),
      ),
      mutationMeasured: group.filter(
        (r) => r.mutation?.score !== null && r.mutation?.score !== undefined,
      ).length,
      mutationKilled: group.reduce((n, r) => n + (r.mutation?.killed ?? 0), 0),
      mutationValid: group.reduce((n, r) => n + (r.mutation?.valid ?? 0), 0),
      newInfrastructure: group.reduce((n, r) => n + (r.newInfrastructure?.length ?? 0), 0),
      tautologySignals: group.reduce((n, r) => n + (r.signals?.tautology.length ?? 0), 0),
      sourceMeasured: group.filter((r) => Object.keys(r.sources ?? {}).length).length,
      exports: mean(
        group
          .filter((r) => Object.keys(r.sources ?? {}).length)
          .map((r) => r.newExports?.length ?? 0),
      ),
      usedOnceSignals: mean(
        group
          .filter((r) => Object.keys(r.sources ?? {}).length)
          .map((r) => r.signals?.usedOnce.length ?? 0),
      ),
      added: mean(
        group
          .filter((r) => Object.keys(r.sources ?? {}).length)
          .map((r) => (r.diffSize?.added ?? 0) + (r.diffSize?.newFileLines ?? 0)),
      ),
      judgeN: group.filter((r) => r.judgment?.valid).length,
      judge: Object.fromEntries(
        ["isolation", "abstraction", "tests", "fit"].map((criterion) => [
          criterion,
          mean(
            group.filter((r) => r.judgment?.valid).map((r) => r.judgment.value[criterion].score),
          ),
        ]),
      ),
      pbt: group.filter((r) => r.pbtExpected && r.signals?.strategies.pbt.length).length,
      unnecessaryPbt: group.filter((r) => !r.pbtExpected && r.signals?.strategies.pbt.length)
        .length,
      tokens: group.reduce(
        (n, r) => n + Object.values(r.run?.tokens ?? {}).reduce((sum, value) => sum + value, 0),
        0,
      ),
      calls: group.reduce((n, r) => n + (r.run?.toolCalls.length ?? 0), 0),
      usd: group.reduce(
        (n, r) => n + (r.run?.costEstimateUsd ?? 0) + (r.judgment?.run?.costEstimateUsd ?? 0),
        0,
      ),
      skillLoads: group.flatMap((r) =>
        (r.run?.skillLoads ?? []).map((s) => ({ id: r.id, skill: s.skill })),
      ),
    }),
  );
}

export function paired(rows) {
  return rows
    .filter((r) => r.condition !== "none")
    .map((row) => {
      const baseline = rows.find(
        (r) =>
          r.task === row.task &&
          r.model === row.model &&
          r.seed === row.seed &&
          r.condition === "none",
      );

      if (!baseline) return { id: row.id, paired: false };

      return {
        id: row.id,
        paired: true,
        baseline: baseline.id,
        task: row.task,
        model: row.model,
        condition: row.condition,
        complete: row.run?.status === "completed" && baseline.run?.status === "completed",
        acceptanceDelta:
          Number(Boolean(row.acceptance?.pass)) - Number(Boolean(baseline.acceptance?.pass)),
        mutationDelta:
          row.mutation?.score != null && baseline.mutation?.score != null
            ? row.mutation.score - baseline.mutation.score
            : null,
        judgmentDelta: Object.fromEntries(
          ["isolation", "abstraction", "tests", "fit"].map((criterion) => [
            criterion,
            row.judgment?.valid && baseline.judgment?.valid
              ? row.judgment.value[criterion].score - baseline.judgment.value[criterion].score
              : null,
          ]),
        ),
        usdDelta: (row.run?.costEstimateUsd ?? 0) - (baseline.run?.costEstimateUsd ?? 0),
      };
    });
}

async function report(dir) {
  const rows = [];

  for (const file of await readdir(dir)) {
    if (!/-(?:none|full|testing|build)-[12]\.json$/.test(file)) continue;
    rows.push(JSON.parse(await readFile(path.join(dir, file), "utf8")));
  }

  const ledger = JSON.parse(await readFile(path.join(dir, "ledger.json"), "utf8"));
  const result = {
    planned: matrix().length,
    attempted: rows.length,
    usd: ledger.spent,
    groups: summarize(rows),
    pairs: paired(rows),
    missing: matrix()
      .filter(
        (c) =>
          !rows.some(
            (r) =>
              r.task === c.task.id &&
              r.seed === c.seed &&
              r.condition === c.condition &&
              r.model === c.model,
          ),
      )
      .map(({ task, ...cell }) => ({ task: task.id, ...cell })),
  };

  await writeFile(path.join(dir, "summary.json"), JSON.stringify(result, null, 2));

  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await report(path.resolve(process.argv[2]));

  console.log(JSON.stringify(result, null, 2));
}
