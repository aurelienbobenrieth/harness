import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { root } from "./common.mjs";
if (!process.env.EVALS_MAX_USD) process.env.EVALS_MAX_USD = "10";
for (const stage of [
  "collect",
  "timing",
  "mining",
  existsSync(path.join(root, "evals/deterministic/fixtures.json")) ? "replay" : "recall",
  "precision",
  "report",
]) {
  const result = spawnSync(process.execPath, [`evals/deterministic/${stage}.mjs`], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    console.error(`${stage} failed; completed evidence is retained in evals/results/deterministic`);
    process.exit(result.status ?? 2);
  }
}
