import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
const scope = process.argv[2];
const r = existsSync("calc.test.mjs")
  ? spawnSync(process.execPath, ["--test", "calc.test.mjs"], { encoding: "utf8" })
  : { status: 0, stdout: "No tests selected" };
appendFileSync(
  ".evidence.jsonl",
  JSON.stringify({
    scope,
    source: readFileSync("calc.mjs", "utf8"),
    test: existsSync("calc.test.mjs") ? readFileSync("calc.test.mjs", "utf8") : "",
    status: r.status,
    output: r.stdout + r.stderr,
  }) + "\n",
);
console.log(r.stdout);
process.exitCode = r.status;
