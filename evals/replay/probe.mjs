import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tasks } from "./tasks.mjs";
import { workspace, git, hiddenTests, overlay } from "./workspace.mjs";
import { stryker } from "./stryker.mjs";

const repository = process.env.KEEPCART_REPOSITORY ?? "C:/Users/aurel/Documents/root/projects/keepcart/app";
const donor = process.env.KEEPCART_DEPENDENCIES ?? "C:/Users/aurel/.t3/worktrees/app/v2-t-N-orchestrator-2026-10-25";
const task = tasks.find((t) => t.id === "archive-codec");
const trial = await workspace({ repository, donor, task, condition: "none" });

try {
  const file = task.scope[0];
  const text = await git(repository, "show", `${task.commit}:${file}`);
  const hidden = await hiddenTests(repository, task);
  const outcome = await overlay(trial.cwd, { ...hidden, [file]: text }, () =>
    stryker(trial.cwd, { [file]: text }, task.tests, true),
  );
  const out = path.resolve(import.meta.dirname, "../results/replay/keepcart-v1/stryker-probe.json");

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(outcome, null, 2));
  console.log(outcome.status);
} finally {
  await trial.cleanup();
}
