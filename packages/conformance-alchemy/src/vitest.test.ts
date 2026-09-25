import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { createFixture, stack } from "./checks/test-support.js";

const run = promisify(execFile);
const workspaceRoot = path.resolve(import.meta.dirname, "../../..");

type JsonReport = {
  readonly testResults: readonly { readonly assertionResults: readonly { title: string; status: string }[] }[];
};

it("registers one test per check: skipped exclusions and missing evidence, failed errors, passed clean checks", async () => {
  const project = await createFixture({
    "package.json": JSON.stringify({ dependencies: { alchemy: "^2.0.0-beta.79" } }),
    ".gitignore": ".alchemy/\n",
    "alchemy.run.ts": stack("localState()"),
  });
  const options = JSON.stringify({ root: project, skipChecks: ["preview-cleanup"] });
  const suite = await createFixture({
    "vitest.config.mjs": 'export default { test: { include: ["suite.test.mjs"], pool: "forks" } };',
    "suite.test.mjs": `import { alchemyConformance } from ${JSON.stringify(pathToFileURL(path.resolve(import.meta.dirname, "../dist/vitest.mjs")).href)};
alchemyConformance(${options});
`,
  });
  const output = path.join(suite, "report.json");
  const cli = path.join(workspaceRoot, "node_modules/vitest/vitest.mjs");
  await run(
    process.execPath,
    [cli, "run", "--config", "vitest.config.mjs", "--reporter=json", "--outputFile", output],
    {
      cwd: suite,
      timeout: 20_000,
      windowsHide: true,
    },
  ).catch((error: unknown) => {
    if (!(error instanceof Error && "code" in error && error.code === 1)) throw error;
  });
  const report: JsonReport = JSON.parse(await readFile(output, "utf8"));
  const statuses = new Map(
    report.testResults.flatMap((file) => file.assertionResults).map((test) => [test.title.split(":")[0], test.status]),
  );
  expect(Object.fromEntries(statuses)).toEqual({
    "alchemy-pinned-exact": "failed",
    "alchemy-state-gitignored": "passed",
    "ci-uses-remote-state": "skipped",
    "preview-cleanup": "skipped",
  });
}, 30_000);
