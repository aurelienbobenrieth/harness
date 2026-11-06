import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Deterministic measures of the code an agent left; none of them needs a judge. */
const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
const node = (cwd, args, input) =>
  spawnSync(process.execPath, args, { cwd, input, encoding: "utf8", env, timeout: 30000, windowsHide: true });

async function walk(cwd, folder) {
  const entries = await readdir(path.join(cwd, folder), { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? walk(cwd, path.join(folder, entry.name))
        : [path.join(folder, entry.name).replaceAll("\\", "/")],
    ),
  );
  return nested.flat();
}

const code = (text) => text.split(/\r?\n/).filter((line) => line.trim() && !/^\s*(?:\/\/|\/?\*)/.test(line));

/** Lines in the file that the original did not have, as a multiset. */
function added(text, original = "") {
  const left = new Map();
  for (const line of code(original)) left.set(line, (left.get(line) ?? 0) + 1);
  return code(text).filter((line) => {
    const count = left.get(line) ?? 0;
    if (count) left.set(line, count - 1);
    return !count;
  });
}

/** Runs tests the agent wrote against another implementation, so internals they lean on show up. */
async function testsAgainst(cwd, source, task) {
  const trial = await mkdtemp(path.join(tmpdir(), "harness-craft-"));
  try {
    await cp(path.join(cwd, "test"), path.join(trial, "test"), { recursive: true });
    await writeFile(path.join(trial, "package.json"), task.files["package.json"]);
    await mkdir(path.join(trial, path.dirname(task.module)), { recursive: true });
    await writeFile(path.join(trial, task.module), source);
    const { status, stdout } = node(trial, ["--test", "--test-timeout=3000", "--test-reporter=tap"]);
    const failed = [...stdout.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((match) => match[1]);
    const ran = [...stdout.matchAll(/^\s*(?:not )?ok \d+ - /gm)].length;
    return { pass: status === 0, ran, failed: new Set(failed), output: stdout.slice(-900) };
  } finally {
    await rm(trial, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

export async function measure(task, cwd) {
  const sources = await walk(cwd, "src");
  const tests = (await walk(cwd, "test")).filter((file) => /\.m?js$/.test(file));
  const read = (file) => readFile(path.join(cwd, file), "utf8");
  const sourceAdded = (
    await Promise.all(sources.map(async (file) => added(await read(file), task.files[file])))
  ).flat();
  const testText = (await Promise.all(tests.map(read))).join("\n");
  const written = Object.fromEntries(
    await Promise.all([...sources, ...tests].map(async (file) => [file, await read(file)])),
  );
  const accepted = node(cwd, ["--input-type=module", "-"], task.acceptance).status === 0;
  const allSource = sourceAdded.join("\n");
  const metrics = {
    accepted,
    sourceLines: sourceAdded.length,
    testLines: code(testText).length,
    newFiles: sources.filter((file) => !(file in task.files)).length,
    exports: sourceAdded.filter((line) => /^\s*export\s/.test(line)).length,
    implicit: (
      allSource.match(
        /catch\s*(?:\([^)]*\))?\s*\{\s*(?:return[^;]*;\s*)?\}|\|\|\s*(?:0|1|""|''|\[\]|\{\}|null)\b|\?\?\s*(?:0|1|""|''|\[\]|\{\}|null)\b/g,
      ) ?? []
    ).length,
    reused: (task.reuse ?? []).every((name) => allSource.includes(name)),
    refactorSafe: null,
    mutation: null,
  };
  if (task.integrated) return { metrics, written };
  const none = { pass: false, ran: 0, failed: new Set(), output: "" };
  const safe = tests.length ? await testsAgainst(cwd, task.reference, task).catch(() => none) : none;
  metrics.refactorSafe = safe.pass;
  metrics.beyondSpec = safe.failed.size;
  const usable = safe.ran > safe.failed.size;
  const killed = [];
  if (usable)
    for (const [from, to] of task.mutants) {
      if (!task.reference.includes(from)) throw new Error(`${task.id}: stale mutant ${from}`);
      const mutated = await testsAgainst(
        cwd,
        task.reference.replace(from, () => to),
        task,
      );
      killed.push([...mutated.failed].some((name) => !safe.failed.has(name)));
    }
  metrics.mutation = usable ? killed.filter(Boolean).length / task.mutants.length : 0;
  return { metrics, written, failure: safe.pass ? undefined : safe.output };
}
