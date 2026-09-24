import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { createFixture, wrangler } from "./checks/test-support.js";

const execute = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

it("maps evaluations to Vitest outcomes: skipped exclusions and missing tools, failed errors, passed clean checks", async () => {
  const project = await createFixture({
    "wrangler.jsonc": wrangler({ compatibility_date: "2026-09-20", vars: { API_TOKEN: "x" } }),
    "package.json": "{}",
  });
  const vitestEntry = pathToFileURL(path.join(repositoryRoot, "node_modules/vitest/dist/index.js")).href;
  const adapter = pathToFileURL(path.resolve(import.meta.dirname, "../dist/vitest.mjs")).href;
  const options = JSON.stringify({ root: project, now: "2026-09-24", skipChecks: ["hyperdrive-contract"] });
  const runner = await createFixture({
    "vitest.config.mjs": 'export default { test: { include: ["adapter.test.mjs"], pool: "forks" } };',
    "adapter.test.mjs": `import { describe } from ${JSON.stringify(vitestEntry)};
import { cloudflareConformance } from ${JSON.stringify(adapter)};
describe("fixture", () => cloudflareConformance(${options}));
`,
  });
  const output = path.join(runner, "results.json");
  await execute(
    process.execPath,
    [
      path.join(repositoryRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      "vitest.config.mjs",
      "--reporter=json",
      "--outputFile",
      output,
    ],
    { cwd: runner, timeout: 20_000, windowsHide: true },
  ).catch((error: unknown) => {
    if (!(error instanceof Error) || !("code" in error) || error.code !== 1) throw error;
  });
  const results: { testResults: { assertionResults: { title: string; status: string }[] }[] } = JSON.parse(
    await readFile(output, "utf8"),
  );
  const outcomes = Object.fromEntries(
    results.testResults
      .flatMap((file) => file.assertionResults)
      .map((assertion) => [assertion.title.split(":")[0], assertion.status]),
  );
  expect(outcomes).toEqual({
    "wrangler-types-current": "skipped",
    "no-secrets-in-vars": "failed",
    "environment-bindings-redeclared": "passed",
    "compatibility-date-current": "passed",
    "observability-enabled": "failed",
    "hyperdrive-contract": "skipped",
  });
}, 30_000);
