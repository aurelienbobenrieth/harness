import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const folder = new URL("../results/optimization/", import.meta.url);
const rows = new Map(),
  costs = new Map();
for (const file of (await readdir(folder)).filter((f) => f.endsWith(".jsonl")).toSorted()) {
  for (const line of (await readFile(new URL(file, folder), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)) {
    const r = JSON.parse(line);
    if (!r.id || !r.run) continue;
    for (const run of [r.run, r.judgment].filter(Boolean)) {
      const hash = createHash("sha256").update(JSON.stringify(run)).digest("hex");
      costs.set(hash, run.costEstimateUsd ?? 0);
    }
    rows.set([r.skillsRevision, r.run.provider, r.seed, r.phase, r.id].join("/"), r);
  }
}
const groups = Map.groupBy([...rows.values()], (r) => `${r.skillsRevision}/${r.run.provider}`);
const totals = (rs) => ({
  passed: rs.filter((r) => r.grade.pass).length,
  total: rs.length,
  calls: rs.reduce((n, r) => n + r.run.toolCalls.length, 0),
  tokens: rs.reduce((n, r) => n + Object.values(r.run.tokens).reduce((a, b) => a + b, 0), 0),
  usd: rs.reduce((n, r) => n + r.run.costEstimateUsd + (r.judgment?.costEstimateUsd ?? 0), 0),
});
const conditions = [...groups].map(([condition, rs]) => ({
  condition,
  ref: rs[0].skillsRef,
  runs: rs.length,
  censored: rs.filter((r) => r.run.status === "budget").length,
  economy: totals(rs.filter((r) => r.phase === "behavior" && r.skill === "economy")),
  quality: totals(rs.filter((r) => r.phase === "behavior" && r.skill !== "economy")),
  skills: ["git", "communication", "build", "testing", "economy"].map((skill) => {
    const behavior = rs.filter((r) => r.skill === skill && r.phase === "behavior"),
      load = rs.filter((r) => r.skill === skill && r.phase === "trigger" && r.mode !== "always-on");
    return {
      skill,
      behavior: `${behavior.filter((r) => r.grade.pass).length}/${behavior.length}`,
      load: `${load.filter((r) => r.pass).length}/${load.length}`,
      failures: behavior
        .filter((r) => !r.grade.pass)
        .map((r) => ({ id: r.id, seed: r.seed, grade: r.grade })),
    };
  }),
}));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const bytes = Object.fromEntries(
  ["origin/steering/economy", "origin/skills/terse", "skills/opt"].map((ref) => {
    const names = git("ls-tree", "-r", "--name-only", ref, "--", "skills").split("\n");
    return [
      ref,
      names.reduce(
        (n, file) => n + Buffer.byteLength(execFileSync("git", ["show", `${ref}:${file}`])),
        0,
      ),
    ];
  }),
);
const report = {
  conditions,
  bytes,
  recordedUsd: [...costs.values()].reduce((a, b) => a + b, 0),
  note: "Unique recorded runs, including invalid probes; add unrecorded interruption reservations separately. Later retries replace scores, never costs.",
};
await writeFile(new URL("summary.json", folder), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
