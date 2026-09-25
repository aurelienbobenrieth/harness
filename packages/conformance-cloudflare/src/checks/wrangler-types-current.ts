/**
 * Runs the project's own `wrangler types --check` for each selected config, so a stale generated `Env`
 * fails the suite. Wrangler owns the type generation; this check only maps its outcome into the report.
 * It starts Wrangler's JavaScript entry with the current Node binary and no shell, so Windows `.cmd`
 * shims never run. A missing Wrangler install is unsupported evidence, never a pass.
 *
 * @attribution https://developers.cloudflare.com/workers/languages/typescript/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/workers/wrangler/commands/workers/ (inspiration; independently implemented)
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord, selectWranglerConfigs } from "../wrangler-config.js";

const id = "wrangler-types-current";
const docs = "https://developers.cloudflare.com/workers/languages/typescript/";
const defaultTimeoutMs = 120_000;

type Outcome =
  | { readonly kind: "exited"; readonly code: number; readonly output: string }
  | { readonly kind: "timed-out" }
  | { readonly kind: "not-started"; readonly output: string };

/** Finds the `wrangler` bin script Node would resolve from `directory`, never above `root`. */
async function wranglerEntry(directory: string, root: string): Promise<string | undefined> {
  for (let current = directory; ; current = path.dirname(current)) {
    const packageDirectory = path.join(current, "node_modules", "wrangler");
    try {
      const manifest: unknown = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
      const bin = isRecord(manifest) ? manifest["bin"] : undefined;
      const entry = typeof bin === "string" ? bin : isRecord(bin) ? bin["wrangler"] : undefined;
      if (typeof entry === "string") return path.join(packageDirectory, entry);
    } catch {
      // Not installed at this level; keep walking up.
    }
    if (current === root || path.dirname(current) === current) return undefined;
  }
}

function runNode(script: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<Outcome> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [script, ...args],
      {
        cwd,
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        shell: false,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
      (error, stdout, stderr) => {
        const output = `${stdout}\n${stderr}`.trim();
        if (error === null) resolve({ kind: "exited", code: 0, output });
        else if (error.killed || error.signal === "SIGKILL") resolve({ kind: "timed-out" });
        else if (typeof error.code === "number") resolve({ kind: "exited", code: error.code, output });
        else resolve({ kind: "not-started", output: error.message });
      },
    );
  });
}

function tail(text: string, maxLength = 400): string {
  return text.length <= maxLength ? text : `…${text.slice(-maxLength)}`;
}

export const wranglerTypesCurrent: ConformanceCheck = {
  id,
  description: "The committed Wrangler-generated types match the current config (wrangler types --check).",
  docs,
  async run(options) {
    const timeoutMs = options.wranglerTypes?.timeoutMs ?? defaultTimeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0)
      throw new Error(`wranglerTypes.timeoutMs must be a positive integer: ${timeoutMs}`);
    const root = path.resolve(options.root);
    const selection = await selectWranglerConfigs(options, id, docs);
    const results: ConformanceFinding[] = [...selection.findings];
    for (const relative of selection.paths) {
      const configPath = path.join(root, relative);
      const directory = path.dirname(configPath);
      const report = (finding: Omit<ConformanceFinding, "check" | "docs" | "path">): void => {
        results.push({ check: id, docs, path: relative, ...finding });
      };
      const entry = await wranglerEntry(directory, root);
      if (entry === undefined) {
        report({
          severity: "warning",
          evaluation: "unsupported",
          message: `wrangler is not installed for ${relative}, so its generated types were not checked. Add wrangler as a devDependency.`,
        });
        continue;
      }
      const args = ["types", "--check", "--config", configPath, ...(options.wranglerTypes?.args ?? [])];
      const outcome = await runNode(entry, args, directory, timeoutMs);
      if (outcome.kind === "timed-out")
        report({
          severity: "error",
          evaluation: "failed",
          message: `wrangler types --check did not finish within ${timeoutMs} ms for ${relative}; types not evaluated.`,
        });
      else if (outcome.kind === "not-started")
        report({
          severity: "error",
          evaluation: "failed",
          message: `wrangler types --check could not start for ${relative}: ${tail(outcome.output)}`,
        });
      else if (outcome.code !== 0)
        report({
          severity: "error",
          message: `wrangler types --check failed for ${relative} (exit ${outcome.code}). Run \`wrangler types\` and commit the regenerated file. Output: ${tail(outcome.output)}`,
        });
    }
    return results;
  },
};
