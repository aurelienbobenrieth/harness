import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

/** Read-only evidence for a human/agent to finish a result-first commit and PR. */
export function draft(cwd = process.cwd(), base) {
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 2e6 }).trim();
  const names = git("diff", "--cached", "--name-only", "-z").split("\0").filter(Boolean);
  if (!names.length) throw new Error("No staged changes; stage explicit task paths first.");
  const groups = { code: [], tests: [], docs: [] };
  for (const name of names)
    groups[/\.(test|spec)\./u.test(name) ? "tests" : name.endsWith(".md") ? "docs" : "code"].push(
      name,
    );
  const history = base
    ? git("log", "--format=%s", `${base}..HEAD`)
    : git("log", "-5", "--format=%s");
  return `fix: <resulting behavior>\n\nPR: <trigger now produces intended result>\n\n${Object.entries(
    groups,
  )
    .filter(([, files]) => files.length)
    .map(([group, files]) => `${group}: ${files.join(", ")}`)
    .join(
      "\n",
    )}\n\nStaged diff:\n${git("diff", "--cached", "--stat")}\n\nBranch log:\n${history}\n\nValidation: <commands actually run and results>\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(draft(process.cwd(), process.argv[2]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
