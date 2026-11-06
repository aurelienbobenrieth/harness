import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./io.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
test("local delegation worker validates all eight adapters without a child model", async () => {
  const f = await fixture("behavior", "none");
  try {
    await mkdir(path.join(f.cwd, "adapters"));
    for (let i = 0; i < 8; i++)
      await writeFile(
        path.join(f.cwd, `adapters/adapter-${i}.test.mjs`),
        `import assert from 'node:assert/strict';import {parse} from './adapter-${i}.mjs';assert.equal(parse('3'),3);assert.throws(()=>parse('bad'),TypeError);`,
      );
    const brief = "GOAL validate adapters; DONE-WHEN all tests pass; BUDGET 10 calls";
    const requests = [
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "delegate_task", arguments: { brief } },
      },
    ];
    const r = spawnSync(process.execPath, ["delegate.mjs"], {
      cwd: f.cwd,
      input: requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(r.status, 0, r.stderr);
    const responses = r.stdout.trim().split("\n").map(JSON.parse);
    assert.equal(JSON.parse(responses[2].result.content[0].text).exitCode, 0);
    assert.equal(JSON.parse(await readFile(path.join(f.cwd, ".delegations.jsonl"), "utf8")).brief, brief);
  } finally {
    await f.cleanup();
  }
});
