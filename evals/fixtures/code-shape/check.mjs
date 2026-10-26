import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const tests = readdirSync("tests")
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => `tests/${name}`);
if (!tests.length) throw Error("No tests selected");
const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...tests], {
  encoding: "utf8",
  windowsHide: true,
});
console.log(result.stdout + result.stderr);
process.exitCode = result.status ?? 2;
