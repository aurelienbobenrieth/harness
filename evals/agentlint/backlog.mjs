/* eslint-disable no-await-in-loop -- Replay sources sequentially to bound parser memory. */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { catalog, root } from "./run.mjs";

const artifactPath = path.resolve(root, "evals/agentlint", process.argv[2] ?? "local/pr88/agentlint-review.json");
const state = JSON.parse(readFileSync(artifactPath, "utf8")).state;
const verdicts = JSON.parse(readFileSync(path.join(root, "evals/agentlint/verdicts.json"), "utf8"));
const unresolved = state.findings.filter((finding) => finding.status === "unresolved");
const changed = (await catalog()).filter((entry) => verdicts[entry.id].verdict === "fix");
const fixes = [];
for (const entry of changed) {
  const old = state.findings.filter((finding) => finding.ruleId === entry.id);
  const oldFiles = new Set(old.map((finding) => finding.file));
  const missingSources = [...oldFiles].filter((file) => typeof state.sources[file] !== "string");
  if (missingSources.length) throw Error(`Artifact is missing ${missingSources.length} affected sources`);
  const counts = new Map();
  const errors = [];
  for (const [sourceFile, source] of Object.entries(state.sources)) {
    if (!/\.[cm]?[jt]sx?$/.test(sourceFile)) continue;
    try {
      const findings = await testRuleOnSource({ rule: entry.rule, source, file: sourceFile });
      if (findings.length) counts.set(sourceFile, findings.length);
    } catch (error) {
      errors.push({ file: sourceFile, error: String(error).slice(0, 300) });
      // Keep every old obligation in an unavailable file, including previously accepted ones.
      counts.set(sourceFile, old.filter((finding) => finding.file === sourceFile).length);
    }
  }
  fixes.push({
    id: entry.id,
    oldUnresolved: old.filter((finding) => finding.status === "unresolved").length,
    oldAccepted: old.filter((finding) => finding.status === "accepted").length,
    afterNeedingFreshDecision: [...counts.values()].reduce((sum, count) => sum + count, 0),
    errors,
  });
  console.log(entry.id, fixes.at(-1));
}
const changedIds = new Set(changed.map((entry) => entry.id));
const retiring = new Set(
  Object.entries(verdicts)
    .filter(([, value]) => ["merge", "replace", "remove"].includes(value.verdict))
    .map(([id]) => id),
);
const localRules = unresolved.filter((finding) => !verdicts[finding.ruleId]);
const keep = unresolved.filter((finding) => !changedIds.has(finding.ruleId) && !retiring.has(finding.ruleId));
const result = {
  artifactVersion: state.version,
  generatedAt: state.generatedAt,
  base: state.base,
  availableSources: Object.keys(state.sources).length,
  baseline: {
    total: unresolved.length,
    human: unresolved.filter((finding) => finding.authority === "human").length,
    agent: unresolved.filter((finding) => finding.authority === "agent").length,
  },
  fixedOnly:
    unresolved.filter((finding) => !changedIds.has(finding.ruleId)).length +
    fixes.reduce((sum, fix) => sum + fix.afterNeedingFreshDecision, 0),
  proposed: keep.length + fixes.reduce((sum, fix) => sum + fix.afterNeedingFreshDecision, 0),
  retiredSourceObligations: unresolved.filter((finding) => retiring.has(finding.ruleId)).length,
  humanRemaining: keep.filter((finding) => finding.authority === "human").length,
  localRules: Object.fromEntries(
    [...new Set(localRules.map((finding) => finding.ruleId))].map((id) => [
      id,
      localRules.filter((finding) => finding.ruleId === id).length,
    ]),
  ),
  fixes,
  caveats: [
    "Conditional projection, not a consumer config change or approval.",
    "Retired triggers must be consolidated into their target reviews by the owner; replacement lint findings are not counted here.",
    "Changed standard/detector versions reopen surviving acceptances; the replay counts all new matches, including previously accepted sites.",
    "Artifact sources are the available replay population, not a fresh complete scan; new triggers outside those sources are unmeasured.",
    "CI artifact engine 0.9.1 and replay engine 0.3.0 differ; parser failures retain old obligations conservatively.",
  ],
};
writeFileSync(path.join(root, "evals/agentlint/local/backlog.json"), JSON.stringify(result, null, 2));
