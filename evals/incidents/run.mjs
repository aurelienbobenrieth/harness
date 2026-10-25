import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { files, options, results } from "../lib/io.mjs";
import { detect, weekOf } from "./detectors.mjs";

const opts = options();
const from = new Date(opts.from ?? Date.now() - 7 * 86400000),
  to = new Date(opts.to ?? Date.now());
if (!Number.isFinite(+from) || !Number.isFinite(+to) || from >= to)
  throw new Error("Require --from <ISO> before --to <ISO> (exclusive)");
const sources = opts.include.length
  ? opts.include
  : [path.join(homedir(), ".claude/projects"), path.join(homedir(), ".codex/sessions")];
const output = await results("incidents"),
  weekly = {},
  warnings = [];
let sessions = 0,
  malformed = 0;
for (const source of sources) {
  let paths;
  try {
    paths = (await stat(source)).isDirectory() ? await files(source) : [source];
  } catch (error) {
    warnings.push(`${source}: ${error.message}`);
    continue;
  }
  for (const file of paths.filter((p) => p.endsWith(".jsonl"))) {
    // A file last modified before the requested window cannot contain newer events.
    if ((await stat(file)).mtimeMs < +from) continue;
    const groups = {},
      metadata = [];
    for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        malformed++;
        continue;
      }
      if (e.type === "session_meta" || e.type === "turn_context") metadata.push(e);
      const ts = new Date(e.timestamp);
      if (!Number.isFinite(+ts) || ts < from || ts >= to) continue;
      const week = weekOf(ts);
      (groups[week] ??= []).push(e);
    }
    if (Object.keys(groups).length) sessions++;
    for (const [week, events] of Object.entries(groups)) {
      const counts = detect([...metadata, ...events]);
      const row = { session: path.basename(file), week, ...counts };
      await output.record(row);
      const totals = (weekly[week] ??= { sessions: 0 });
      totals.sessions++;
      for (const [key, value] of Object.entries(counts)) totals[key] = (totals[key] ?? 0) + value;
    }
  }
}
if (opts.git) {
  const log = execFileSync(
    "git",
    ["-C", opts.git, "log", `--since=${from.toISOString()}`, `--until=${to.toISOString()}`, "--format=%cI%x09%s"],
    { encoding: "utf8" },
  );
  const groups = {};
  for (const line of log.trim().split("\n").filter(Boolean)) {
    const [timestamp, subject] = line.split("\t");
    (groups[weekOf(timestamp)] ??= []).push({ subject });
  }
  for (const [week, commits] of Object.entries(groups)) {
    const signal = detect([], { commits }).proofCommitWindow;
    (weekly[week] ??= { sessions: 0 }).proofCommitWindow = signal;
    await output.record({ week, commits: commits.length, proofCommitWindow: signal });
  }
}
const keys = [
  "sessions",
  "pollingLoops",
  "above200k",
  "fullGateRuns",
  "proofCommitWindow",
  "nativeSubagentsWithT3",
  "cacheWrite5m",
  "cacheWrite1h",
  "cacheWriteUnknown",
];
const summary =
  `# Incident replay\n\nWindow [${from.toISOString()}, ${to.toISOString()}); ${sessions} transcript files; ${malformed} malformed lines. Cost: $0.\n\n| Week (UTC Monday) | ${keys.join(" | ")} |\n|---|${keys.map(() => "---:").join("|")}|\n` +
  Object.entries(weekly)
    .toSorted()
    .map(([week, counts]) => `| ${week} | ${keys.map((k) => counts[k] ?? 0).join(" | ")} |`)
    .join("\n") +
  `\n\nProof commits: ${opts.git ? "weekly heuristic, not a fabrication verdict" : "not measured (pass --git <repo>)"}.\n${warnings.join("\n")}\n`;
await output.summary(summary);
console.log(summary);
if (!sessions || warnings.length) process.exitCode = 2;
