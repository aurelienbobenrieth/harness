import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { command, overlay } from "./workspace.mjs";

/** In-place is safe only in the disposable trial; always restore originals after timeout/crash. */
export async function stryker(cwd, sources, tests, dryRunOnly = false) {
  const files = Object.keys(sources).filter((name) => !/(?:\.test\.|\/testing[./]|\/testing\.|\.config\.)/.test(name));

  if (!tests.length || !files.length) return { status: "skipped", score: null };
  await mkdir(path.join(cwd, ".replay"), { recursive: true });
  const config = {
    testRunner: "vitest",
    plugins: ["@stryker-mutator/vitest-runner"],
    coverageAnalysis: "perTest",
    mutate: files,
    testFiles: tests,
    inPlace: true,
    concurrency: 1,
    dryRunOnly,
    vitest: { configFile: "vite.config.ts", related: false },
    reporters: ["json"],
    jsonReporter: { fileName: ".replay/mutation.json" },
    tempDirName: ".replay/stryker-tmp",
    timeoutMS: 20000,
    timeoutFactor: 1.5,
  };

  await writeFile(path.join(cwd, ".replay/stryker.json"), JSON.stringify(config));
  const outcome = await overlay(cwd, sources, () =>
    command(
      process.execPath,
      [path.join(cwd, "node_modules/@stryker-mutator/core/bin/stryker.js"), "run", ".replay/stryker.json"],
      cwd,
      120000,
    ),
  );
  const report = await readFile(path.join(cwd, ".replay/mutation.json"), "utf8")
    .then(JSON.parse)
    .catch(() => null);

  return { status: outcome.status === 0 && report ? "measured" : "unavailable", outcome, report };
}
