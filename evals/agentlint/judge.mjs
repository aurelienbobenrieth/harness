/* eslint-disable no-await-in-loop -- One ledger bounds all judge calls and survives interruptions. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { budget, judge } from "../lib/runner.mjs";
import { root, consumers } from "./run.mjs";

const local = path.join(root, "evals/agentlint/local");
const ledgerFile = path.join(local, "ledger.json");
const ledger = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, "utf8")) : [];
budget.limit = Math.min(10, Number(process.env.EVALS_MAX_USD ?? 10));
budget.spent = ledger.reduce((sum, item) => sum + item.usd, 0);
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const phase = process.argv[2] ?? "baseline";
const catalog = JSON.parse(readFileSync(path.join(local, `${phase}-catalog.json`), "utf8"));
const runs = ["keepcart", "kitbois", "panache", "studio"].map((repo) => ({
  repo,
  ...JSON.parse(readFileSync(path.join(local, `${phase}-${repo}.json`), "utf8")),
}));
const results = [];
const sources = new Map();
async function grade(input, key, count) {
  const cached = ledger.find((item) => item.key === key);
  if (cached) return cached;
  let entry;
  try {
    const result = await judge({
      input,
      maxUsd: 0.3,
      timeoutMs: 120000,
      maxTurns: 3,
      rubric:
        'Return {"judgments":[{"index":0,"label":"tp","reason":"short concrete reason","diagnosis":"none"}]}. Use labels tp, fp, uncertain and diagnoses scope, heuristic, exemption, engine, none. Emit exactly one judgment per sample, using its supplied numeric index in order. Precision means a concrete actionable violation of the written standard, not just matching its trigger. Missing context or no demonstrated defect means uncertain, never fp. An obviously valid exception, documented legitimate implementation, or unrelated domain is fp. A valid review candidate without a proved defect is uncertain. Finite sequences and explicit finite budgets alone are not unbounded work. Consider surrounding evidence, bounds, UI defaults, internal helper/capability types and test scaffolding. Never infer unseen behavior. Do not reproduce source code.',
    });
    const judgments = result.value.judgments;
    if (
      !Array.isArray(judgments) ||
      judgments.length !== count ||
      judgments.some((item, index) => item.index !== index || !["tp", "fp", "uncertain"].includes(item.label))
    )
      throw Object.assign(Error("Invalid judgment shape"), { run: result.run });
    entry = { key, usd: result.run.costEstimateUsd, model: result.run.model, judgments };
  } catch (error) {
    entry = {
      key,
      usd: error.run?.costEstimateUsd ?? 0,
      error: String(error),
      response: error.run?.messages?.findLast((message) => message.role === "assistant")?.content?.slice(0, 2000),
    };
  }
  ledger.push(entry);
  writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2));
  return entry;
}
for (const rule of catalog) {
  const queues = runs.map((run) =>
    run.findings
      .filter((finding) => finding.rule.id === rule.id)
      .map((finding) => ({
        repo: run.repo,
        file: finding.location.file,
        line: finding.location.line,
        message: finding.message,
        excerpt: finding.context ?? finding.snippet,
      }))
      .toSorted((a, b) => hash(a).localeCompare(hash(b))),
  );
  const samples = [];
  for (let index = 0; index < 8 && queues.some((queue) => queue.length); index++) {
    const queue = queues[index % queues.length];
    if (queue.length) samples.push(queue.shift());
    else {
      const available = queues.find((candidate) => candidate.length);
      samples.push(available.shift());
    }
  }
  if (!samples.length) {
    results.push({ id: rule.id, samples: [] });
    continue;
  }
  for (const sample of samples) {
    const run = runs.find((candidate) => candidate.repo === sample.repo);
    const sourceKey = `${sample.repo}:${run.commit}:${sample.file}`;
    if (!sources.has(sourceKey)) {
      try {
        sources.set(
          sourceKey,
          execFileSync("git", ["show", `${run.commit}:${sample.file}`], {
            cwd: consumers[sample.repo],
            encoding: "utf8",
            maxBuffer: 20e6,
            stdio: ["ignore", "pipe", "pipe"],
          }),
        );
      } catch {
        sources.set(sourceKey, undefined);
      }
    }
    const source = sources.get(sourceKey);
    if (source && source.length <= 18000) sample.excerpt = source;
    sample.contextIncomplete = !source || source.length > 18000;
  }
  const input = {
    rule: rule.id,
    standard: rule.standard.guidance,
    samples: samples.map((sample, index) => ({ index, ...sample })),
  };
  const key = hash(input);
  let entry = await grade(input, key, samples.length);
  if (entry.error) entry = await grade(input, key + ":retry1", samples.length);
  results.push({
    id: rule.id,
    samples: samples.map((sample, index) => ({ ...sample, judgment: entry.judgments?.[index] })),
    error: entry.error,
  });
  writeFileSync(path.join(local, `${phase}-judgments.json`), JSON.stringify(results, null, 2));
  console.log(
    rule.id,
    samples.length,
    entry.error ?? entry.judgments.map((item) => item.label).join(","),
    budget.spent.toFixed(4),
  );
}
writeFileSync(path.join(local, `${phase}-judgments.json`), JSON.stringify(results, null, 2));
