import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { detect, weekOf } from "./detectors.mjs";
const load = async (name) =>
  (await readFile(new URL(`fixtures/${name}.jsonl`, import.meta.url), "utf8")).trim().split("\n").map(JSON.parse);
test("Claude counts one polling streak, cache-inclusive context and both TTLs", async () => {
  assert.deepEqual(detect(await load("claude"), { t3Available: true }), {
    pollingLoops: 1,
    above200k: 1,
    fullGateRuns: 1,
    proofCommitWindow: 0,
    nativeSubagentsWithT3: 1,
    cacheWrite5m: 10,
    cacheWrite1h: 20,
    cacheWriteUnknown: 0,
  });
});
test("Codex keeps cached tokens inside the 200k context and recognizes native delegation", async () => {
  const result = detect(await load("codex"));
  assert.equal(result.above200k, 1);
  assert.equal(result.fullGateRuns, 2);
  assert.equal(result.nativeSubagentsWithT3, 1);
});
test("intervening reads break polling; no T3 means no delegation incident; unknown TTL stays unknown", async () => {
  const result = detect(await load("quiet"));
  assert.equal(result.pollingLoops, 0);
  assert.equal(result.above200k, 1);
  assert.equal(result.nativeSubagentsWithT3, 0);
  assert.equal(result.cacheWriteUnknown, 15);
  assert.equal(result.cacheWrite1h, 0);
});
test("proof commit heuristic is strictly greater than half and excludes ordinary tests", () => {
  const commits = [
    { subject: "docs(api): explain" },
    { subject: "test(api): prove behavior" },
    { subject: "test(api): reject expired token" },
  ];
  assert.equal(detect([], { commits }).proofCommitWindow, 1);
  assert.equal(detect([], { commits: commits.slice(1) }).proofCommitWindow, 0);
  assert.equal(detect([]).proofCommitWindow, 0);
});
test("weeks start on UTC Monday across Sunday and year boundaries", () => {
  assert.equal(weekOf("2026-10-18T23:59:59Z"), "2026-10-12");
  assert.equal(weekOf("2026-10-19T00:00:00Z"), "2026-10-19");
  assert.equal(weekOf("2027-01-01T00:00:00Z"), "2026-12-28");
});
test("two waits and a normal command do not constitute a polling loop", () => {
  const events = [
    {
      type: "assistant",
      message: {
        content: ["wait", "status", "Bash"].map((name) => ({
          type: "tool_use",
          name,
          input: { command: "pnpm test" },
        })),
      },
    },
  ];
  assert.equal(detect(events).pollingLoops, 0);
  assert.equal(detect(events).fullGateRuns, 0);
});
test("old Codex token-count snapshots deduplicate and defer to authoritative usage records", () => {
  const old = {
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { input_tokens: 200001 },
        last_token_usage: { input_tokens: 200001, cached_input_tokens: 100000 },
      },
    },
  };
  assert.equal(detect([old, old]).above200k, 1);
  assert.equal(detect([old, { type: "token_usage_record", payload: { usage: { input_tokens: 50 } } }]).above200k, 0);
});
test("scoped check scripts are not full gates", () => {
  const events = [
    {
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "pnpm check:types && pnpm check-skills" }),
      },
    },
  ];
  assert.equal(detect(events).fullGateRuns, 0);
});
test("Claude advertised T3 tools establish availability before native delegation", () => {
  const events = [
    { type: "system", subtype: "init", tools: ["mcp__t3_code__delegate_task"] },
    { type: "assistant", message: { content: [{ type: "tool_use", name: "Task", input: {} }] } },
  ];
  assert.equal(detect(events).nativeSubagentsWithT3, 1);
});
