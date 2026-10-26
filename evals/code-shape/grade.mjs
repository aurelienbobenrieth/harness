import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { command, git, sources } from "./fixture.mjs";
import { metrics } from "./metrics.mjs";
import { acceptance } from "./acceptance.mjs";

export const ruleNames = ["temporalCoupling", "abstractionEarnsKeep", "boundaries", "naming", "testing"];
export const rubric = `Return {"rules":[{"rule":"temporalCoupling|abstractionEarnsKeep|boundaries|naming|testing","score":0,"file":"src/file.ts","line":1,"reason":"short evidence"}]} with exactly one entry for each of those five rule names. Score each 0-3: 0 violates the rule or no relevant implementation; 1 mixed/weak; 2 sound; 3 exemplary. Grade the changed code, using the task contract and original context. Temporal coupling: validity does not depend on undocumented call ordering or correlated state. Abstraction earns keep: hide a real decision, no pass-through or speculative abstraction; duplication may be better than premature generality. Boundaries: pure decisions, thin I/O shell, dependencies inward, typed expected failures, bounded selective retries and stable idempotency identity. Naming: domain-specific, exposes intent and units. Testing: independent literal oracles, observable outcomes, regression/edge cases, deterministic dependencies, no weak assertions or tests mirroring implementation. Every entry must cite a real line in the supplied final files. The score is for the resulting diff, not skill usage, verbosity, or following a process.`;

export function validateJudgment(value, final) {
  if (!Array.isArray(value?.rules) || value.rules.length !== ruleNames.length) throw Error("Missing judge rules");
  const seen = new Set();
  for (const rule of value.rules) {
    if (
      !ruleNames.includes(rule.rule) ||
      seen.has(rule.rule) ||
      !Number.isInteger(rule.score) ||
      rule.score < 0 ||
      rule.score > 3 ||
      !Number.isInteger(rule.line) ||
      rule.line < 1 ||
      !final[rule.file] ||
      rule.line > final[rule.file].split("\n").length ||
      !rule.reason?.trim()
    )
      throw Error("Invalid judge score/citation");
    seen.add(rule.rule);
  }
  return value;
}
export async function deterministic(cwd, task, original, base) {
  // Include new files in the diff while retaining the baseline commit even if an agent commits.
  git(cwd, "add", "-N", "--", "src", "tests");
  const final = await sources(cwd);
  const measured = await metrics(cwd, base);
  const addedTests = Object.entries(final).some(
    ([file, text]) => file.startsWith("tests/") && text !== original.files[file],
  );
  const preservedTests = Object.entries(original.files)
    .filter(([file]) => file.startsWith("tests/"))
    .every(([file]) => file in final);
  const configUnchanged =
    (await readFile(path.join(cwd, "check.mjs"), "utf8")) === original.check &&
    (await readFile(path.join(cwd, "package.json"), "utf8")) === original.package;
  await writeFile(path.join(cwd, ".acceptance.test.ts"), acceptance[task.id]);
  const hidden = command(cwd, process.execPath, ["--test", "--test-reporter=tap", ".acceptance.test.ts"], 15000);
  return {
    pass: measured.testsPass && addedTests && preservedTests && configUnchanged && hidden.status === 0,
    measured,
    addedTests,
    preservedTests,
    configUnchanged,
    hidden,
    final,
    diff: git(cwd, "diff", base, "--", "src", "tests"),
  };
}
