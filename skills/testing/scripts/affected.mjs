import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const source = /\.[cm]?[jt]sx?$/u;
const isTest = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.isSymbolicLink() ||
      ["node_modules", ".git", ".agents", ".claude", "dist"].includes(entry.name)
    )
      return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? walk(file, base)
      : [path.relative(base, file).replaceAll("\\", "/")];
  });
}
/** Follow local imports backwards, so edits to a shared dependency select its consumers' tests. */
export function affected(cwd, changed) {
  const all = walk(cwd).filter((file) => source.test(file));
  const impacted = new Set(changed.map((file) => file.replaceAll("\\", "/")));
  const dependencies = new Map(
    all.map((file) => [
      file,
      [
        ...readFileSync(path.join(cwd, file), "utf8").matchAll(
          /(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/gu,
        ),
      ].map((match) => {
        const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
        return all.find(
          (candidate) =>
            candidate === relative ||
            candidate.replace(source, "") === relative.replace(source, ""),
        );
      }),
    ]),
  );
  let size;
  do {
    size = impacted.size;
    for (const [file, deps] of dependencies)
      if (deps.some((dep) => impacted.has(dep))) impacted.add(file);
  } while (size !== impacted.size);
  return all.filter((file) => isTest.test(file) && impacted.has(file)).toSorted();
}

export function run(args, cwd = process.cwd()) {
  const changed = args.length
    ? args
    : execFileSync("git", ["diff", "HEAD", "--name-only", "-z"], { cwd, encoding: "utf8" })
        .split("\0")
        .filter(Boolean);
  const selected = affected(cwd, changed);
  if (!selected.length)
    return { status: 2, summary: "NO TESTS SELECTED; run the project gate explicitly." };
  const pkg = existsSync(path.join(cwd, "package.json"))
    ? JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"))
    : {};
  if (/vitest|vp test/u.test(pkg.scripts?.test ?? ""))
    return {
      status: 2,
      summary: "Use the project's Vitest related command; this helper supports node:test only.",
    };
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...selected], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env,
    timeout: 120000,
    maxBuffer: 8e6,
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  return {
    status: result.status ?? 2,
    summary: `${selected.join(", ")}\n${
      result.status === 0
        ? "PASS"
        : output
            .split(/\r?\n/u)
            .filter((line) => /not ok|error:|expected:|actual:|ERR_|failureType/u.test(line))
            .join("\n") ||
          result.error?.message ||
          output.slice(-2000)
    }`,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = run(process.argv.slice(2));
    console.log(result.summary);
    process.exitCode = result.status;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
