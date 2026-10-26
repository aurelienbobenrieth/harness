import path from "node:path";
import { options } from "../evals/lib/io.mjs";
import { contents, git, check } from "../evals/replay/workspace.mjs";
import { loadSources, verificationPlan, mutationGate } from "../evals/replay/gates.mjs";

const opts = options();
const cwd = path.resolve(opts.cwd ?? ".");
const base = opts.base ?? "HEAD";
const changed = await contents(cwd, base);
const sources = await loadSources(cwd);
const plan = verificationPlan(sources, Object.keys(changed), opts.tests?.split(","));
const lint = await check(cwd, "lint", plan.lint);
// Full workspace type-aware lint checks all touched producers and reverse consumers.
const diff = await git(cwd, "diff", "--unified=0", base);
const lines = new Map();
let file;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ b/")) file = line.slice(6);
  const hunk = line.match(/^@@ .* \+(\d+)(?:,(\d+))? @@/);
  if (file && hunk) {
    const selected = lines.get(file) ?? new Set();
    for (let index = Number(hunk[1]); index < Number(hunk[1]) + Number(hunk[2] ?? 1); index++)
      selected.add(index);
    lines.set(file, selected);
  }
}
for (const [name, source] of Object.entries(changed))
  if (!lines.has(name)) lines.set(name, new Set(source.split("\n").map((_, index) => index + 1)));
const mutation = await mutationGate({
  cwd,
  sources: changed,
  plan,
  changedLines: lines,
  limit: Number(opts.mutants ?? 9),
  codec: opts.codec,
});
console.log(JSON.stringify({ plan, lint, mutation }, null, 2));
if (
  !lint.pass ||
  mutation.status !== "measured" ||
  mutation.results.some((result) => result.status !== "killed")
)
  process.exitCode = 1;
