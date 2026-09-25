import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { createFixture } from "./checks/test-support.js";

const execute = promisify(execFile);

it("reports unavailable evidence as skipped, failed evaluation as failed, and evaluated advice as passed", async () => {
  const missing = await createFixture({ "package.json": '{"name":"missing-tools"}' });
  const invalid = await createFixture({
    "package.json": '{"name":"invalid-tool-report"}',
    "node_modules/knip/package.json": '{"name":"knip","bin":"cli.cjs"}',
    "node_modules/knip/cli.cjs": 'console.log("invalid report");',
  });
  const advisory = await createFixture({
    "package.json": '{"name":"advice","dependencies":{"dayjs":"1.0.0","moment":"2.0.0"}}',
  });
  const adapter = pathToFileURL(path.resolve(import.meta.dirname, "../dist/vitest.mjs")).href;
  const runner = path.resolve(import.meta.dirname, "../../../node_modules/vitest/vitest.mjs");
  const root = await createFixture({
    "vitest.config.mjs": 'export default { test: { include: ["adapter.test.mjs"], pool: "forks" } };',
    "adapter.test.mjs": `
import { describe } from ${JSON.stringify(pathToFileURL(path.resolve(import.meta.dirname, "../../../node_modules/vitest/dist/index.js")).href)};
import { coreConformance } from ${JSON.stringify(adapter)};
describe("unavailable", () => coreConformance({root:${JSON.stringify(missing)}}));
describe("invalid", () => coreConformance({root:${JSON.stringify(invalid)},skipChecks:["duplication-budget"]}));
describe("advisory", () => coreConformance({root:${JSON.stringify(advisory)},skipChecks:["duplication-budget","dead-exports"]}));
describe("required", () => coreConformance({root:${JSON.stringify(missing)},skipChecks:["duplication-budget"],deadExports:{requireKnipConfig:true}}));
`,
  });
  const report = path.join(root, "results.json");
  await execute(
    process.execPath,
    [runner, "run", "--config", "vitest.config.mjs", "--reporter=json", "--outputFile", report],
    {
      cwd: root,
      timeout: 20_000,
      windowsHide: true,
    },
  ).catch((error: unknown) => {
    if (!(error instanceof Error) || !("code" in error) || error.code !== 1) throw error;
  });
  const result: { testResults: { assertionResults: { fullName: string; status: string }[] }[] } = JSON.parse(
    await readFile(report, "utf8"),
  );
  const assertions = result.testResults.flatMap((file) => file.assertionResults);
  const status = (suite: string, check: string) =>
    assertions.find((entry) => entry.fullName.startsWith(`${suite} `) && entry.fullName.includes(`${check}:`))?.status;
  expect(status("unavailable", "dead-exports")).toBe("skipped");
  expect(status("unavailable", "duplication-budget")).toBe("skipped");
  expect(status("invalid", "dead-exports")).toBe("failed");
  expect(status("advisory", "dependency-overlap")).toBe("passed");
  expect(status("required", "dead-exports")).toBe("failed");
}, 30_000);
