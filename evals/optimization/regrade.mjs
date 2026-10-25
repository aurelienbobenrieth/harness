import { readdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { tasks } from "./tasks.mjs";
const folder = new URL("../results/optimization/", import.meta.url),
  rows = new Map();
for (const file of (await readdir(folder))
  .filter((f) => f.endsWith(".jsonl") && !f.startsWith("zz-"))
  .toSorted())
  for (const line of (await readFile(new URL(file, folder), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)) {
    const r = JSON.parse(line);
    if (
      r.id === "comm-fr" ||
      (["test-boundary", "test-empty", "test-flaky"].includes(r.id) &&
        r.artifacts.finalSource &&
        r.artifacts.testSource)
    )
      rows.set([r.skillsRevision, r.run.provider, r.seed, r.id].join("/"), r);
  }
const output = [];
for (const r of rows.values()) {
  if (r.id === "comm-fr") {
    r.grade = tasks.find((t) => t.id === r.id).grade(r.run, r.artifacts);
    if (r.run.status !== "completed")
      r.grade = { ...r.grade, pass: false, incomplete: r.run.status };
    output.push(r);
    continue;
  }
  const cwd = await mkdtemp(path.join(tmpdir(), "harness-regrade-"));
  try {
    await writeFile(path.join(cwd, "calc.mjs"), r.artifacts.finalSource);
    await writeFile(path.join(cwd, "calc.test.mjs"), r.artifacts.testSource);
    const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "calc.test.mjs"], {
      cwd,
      encoding: "utf8",
      timeout: 5000,
    });
    r.artifacts.independentTest = result.status === 0 && /# tests [1-9]/.test(result.stdout);
    r.artifacts.independentOutput = result.stdout + result.stderr;
    r.grade = tasks.find((t) => t.id === r.id).grade(r.run, r.artifacts);
    if (r.run.status !== "completed")
      r.grade = { ...r.grade, pass: false, incomplete: r.run.status };
    r.regraded = "Explicit TAP reporter on unchanged saved source/test snapshots";
    output.push(r);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
await writeFile(
  new URL("zz-regraded.jsonl", folder),
  output.map((r) => JSON.stringify(r)).join("\n") + "\n",
);
console.log(`Regraded ${output.length} unchanged test artifacts without model calls.`);
