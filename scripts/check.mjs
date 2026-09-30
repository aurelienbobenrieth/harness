/**
 * `pnpm check`: builds once, then runs every validation script in two concurrent lanes. Each step's
 * output is buffered and printed when it finishes; a summary follows, and any failure exits non-zero.
 *
 * `HARNESS_AFFECTED_BASE=<ref>` narrows typecheck and unit tests to packages changed since the merge
 * base with `<ref>`, plus their dependents. Changes outside package folders fall back to the full suite.
 */
import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { planCheck, selectScope } from "./check-plan.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pnpm = process.env.npm_execpath;
/**
 * Unit tests are the critical path and already fork a worker per CPU; every other step together takes
 * less time, so one more lane hides them all. A lane per CPU starved file-heavy tests past their 15s timeout.
 */
const lanes = 2;
const grouped = process.env.GITHUB_ACTIONS === "true";
const env = process.stdout.isTTY && !("NO_COLOR" in process.env) ? { ...process.env, FORCE_COLOR: "1" } : process.env;

const lines = (output) => output.split(/\r?\n/u).filter(Boolean);
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

function resolveScope(ref) {
  if (!ref) return { kind: "full", reason: "HARNESS_AFFECTED_BASE is unset" };
  const base = git("merge-base", "HEAD", ref).trim();
  const changed = [
    ...lines(git("diff", "--name-only", base)),
    ...lines(git("ls-files", "--others", "--exclude-standard")),
  ];
  const scope = selectScope(changed);
  if (scope.kind === "full") return scope;
  const listed = execFileSync(process.execPath, [pnpm, "--filter", `...[${base}]`, "list", "--json", "--depth", "-1"], {
    cwd: root,
    encoding: "utf8",
  });
  const packages = (listed.trim() ? JSON.parse(listed) : [])
    .map((project) => path.relative(root, project.path).replaceAll("\\", "/"))
    .filter((directory) => directory !== "")
    .toSorted();
  return { kind: "affected", base, packages };
}

function execute(step) {
  if ("skip" in step) return Promise.resolve({ name: step.name, status: "skip", note: step.skip, output: "" });
  const started = performance.now();
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn(process.execPath, [pnpm, ...step.args], { cwd: root, env, windowsHide: true });
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => chunks.push(Buffer.from(`${error.stack ?? error}\n`)));
    child.on("close", (code) => {
      const note = `${((performance.now() - started) / 1000).toFixed(1)}s`;
      const result = {
        name: step.name,
        status: code === 0 ? "ok" : "FAIL",
        note,
        output: Buffer.concat(chunks).toString(),
      };
      report(result);
      resolve(result);
    });
  });
}

function report({ name, status, note, output }) {
  const title = `${status} ${name} (${note})`;
  if (grouped && status !== "FAIL") process.stdout.write(`::group::${title}\n${output}\n::endgroup::\n`);
  else process.stdout.write(`\n── ${title}\n${output}`);
}

/** Runs steps in list order, never more than `limit` at once; results come back in list order. */
async function pool(steps, limit) {
  const results = Array.from({ length: steps.length });
  let next = 0;
  const worker = async () => {
    const index = next;
    next += 1;
    if (index >= steps.length) return;
    results[index] = await execute(steps[index]);
    await worker();
  };
  await Promise.all(Array.from({ length: Math.min(limit, steps.length) }, worker));
  return results;
}

if (!pnpm) {
  console.error("Run with pnpm check.");
  process.exit(1);
}
const started = performance.now();
const scope = resolveScope(process.env.HARNESS_AFFECTED_BASE);
console.log(
  scope.kind === "full"
    ? `check: full suite (${scope.reason})`
    : `check: affected since ${scope.base.slice(0, 12)}: ${scope.packages.join(", ") || "no package"}`,
);
const plan = planCheck(scope);
const build = await execute(plan.build);
const results = [build, ...(build.status === "ok" ? await pool(plan.steps, lanes) : [])];
const count = (status) => results.filter((result) => result.status === status).length;
console.log("\ncheck summary");
for (const { name, status, note } of results) console.log(`  ${status.padEnd(4)}  ${name.padEnd(26)} ${note}`);
if (build.status !== "ok") console.log(`  build failed; ${plan.steps.length} steps not run`);
console.log(
  `${results.length} steps: ${count("ok")} passed, ${count("skip")} skipped, ${count("FAIL")} failed in ${((performance.now() - started) / 1000).toFixed(1)}s`,
);
if (count("FAIL") > 0) process.exitCode = 1;
