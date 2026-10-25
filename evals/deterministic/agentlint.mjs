import { root, command, git, safeWrite } from "./common.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
/** One real engine pass shares parsing across every state rule; only the disposable clone is writable. */
export async function stateFindings(cwd, entries) {
  const directory = mkdtempSync(path.join(tmpdir(), "det-agentlint-"));
  const clone = path.join(directory, "repo");
  try {
    const cloned = command("git", ["clone", "--shared", "--quiet", "--no-checkout", cwd, clone]);
    if (cloned.exit !== 0) throw Error(cloned.stderr);
    const checkout = command("git", ["checkout", "--detach", git(cwd, "rev-parse", "HEAD")], clone);
    if (checkout.exit !== 0) throw Error(checkout.stderr);
    const packages = [...new Set(entries.map((e) => e.pkg))];
    safeWrite(clone, {
      ".agentlint/config.ts":
        packages
          .map(
            (pkg, index) =>
              `import * as p${index} from ${JSON.stringify(pathToFileURL(path.join(root, "packages", pkg, "dist/index.mjs")).href)};`,
          )
          .join("\n") +
        "\nexport default {rules:[" +
        packages
          .map((pkg, index) => `...Object.values(p${index}).filter(r=>r?.binding?.id && r.lifecycle === "state")`)
          .join(",") +
        "]};",
    });
    const run = command(
      process.execPath,
      [
        path.join(root, "node_modules/@aurelienbbn/agentlint/dist/bin.mjs"),
        "check",
        "--all",
        "--base",
        "HEAD",
        "--format",
        "jsonl",
      ],
      clone,
      300000,
    );
    const records = run.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { type: "invalid", line };
        }
      });
    const error = run.error ?? (![0, 1].includes(run.exit) ? run.stderr || run.stdout.slice(0, 1000) : undefined);
    return {
      run: { ...run, stdout: undefined },
      error,
      findings: records
        .filter((r) => r.type === "finding")
        .map((r) => ({ ...r, file: r.location.file, line: r.location.line, ruleId: r.rule.id })),
      records: records.filter((r) => r.type !== "finding"),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
