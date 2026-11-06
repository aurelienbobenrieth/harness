// Local deterministic worker: records a delegation decision without a paid child model.
import { createInterface } from "node:readline";
import { writeFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const tool = {
  name: "delegate_task",
  description:
    "Delegate the eight adapter edits to a local deterministic fixture worker. No model or network cost. Pass a standalone brief, including budget and checks.",
  inputSchema: { type: "object", properties: { brief: { type: "string" } }, required: ["brief"] },
};
createInterface({ input: process.stdin }).on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = request;
  if (id === undefined) return;
  let result;
  if (method === "initialize")
    result = {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "eval-worker", version: "1.0.0" },
    };
  else if (method === "tools/list") result = { tools: [tool] };
  else if (method === "tools/call" && params.name === "delegate_task") {
    appendFileSync(".delegations.jsonl", JSON.stringify(params.arguments) + "\n");
    for (let i = 0; i < 8; i++)
      writeFileSync(
        `adapters/adapter-${i}.mjs`,
        "export const parse = x => { const n=Number(x); if(!Number.isFinite(n)) throw new TypeError('finite required'); return n; };\n",
      );
    const check = spawnSync(
      process.execPath,
      ["--test", ...Array.from({ length: 8 }, (_, i) => `adapters/adapter-${i}.test.mjs`)],
      { encoding: "utf8", timeout: 10000 },
    );
    result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            worker: "deterministic-fixture",
            exitCode: check.status,
            output: check.stdout,
          }),
        },
      ],
      isError: check.status !== 0,
    };
  } else if (method === "ping") result = {};
  else {
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown method" } }) + "\n",
    );
    return;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
});
