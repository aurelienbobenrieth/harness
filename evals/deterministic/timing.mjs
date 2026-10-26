/* eslint-disable no-await-in-loop -- One instrumented pass per consumer bounds lint subprocesses. */
import { catalog, root, repos, pluginConfig, command, save } from "./common.mjs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const entries = (await catalog()).filter((e) => e.kind === "oxlint"),
  results = [];
const directory = mkdtempSync(path.join(tmpdir(), "det-timings-"));
try {
  const config = path.join(directory, "oxlint.json");
  writeFileSync(config, JSON.stringify(pluginConfig(entries)));
  for (const [repo, cwd] of Object.entries(repos)) {
    const run = command(
      process.execPath,
      [
        path.join(root, "node_modules/oxlint/bin/oxlint"),
        "--threads=2",
        "--config",
        config,
        "--format=json",
        "--debug=timings",
        "--silent",
        cwd,
      ],
      cwd,
      180000,
    );
    results.push({ repo, ...run });
    save("timings", results);
    console.log(repo, run.ms, run.exit, run.stderr.slice(-1800), run.stdout.slice(-3000));
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
