/* eslint-disable no-await-in-loop -- Sequential scans and judge calls bound memory and share one cost ledger. */
import { catalog, root, repos, read, save, load } from "./common.mjs";
import { cachedJudge } from "./judge.mjs";
import { existsSync } from "node:fs";
import { probeSeed } from "./seed-probe.mjs";
import path from "node:path";
const entries = (await catalog()).filter((e) => e.kind !== "agentlint");
const results = existsSync(path.join(root, "evals/results/deterministic/recall.json")) ? load("recall") : [];
const completedIds = new Set(results.map((r) => r.id));
for (let i = 0; i < entries.length; i += 1) {
  const batch = entries.slice(i, i + 1);
  if (batch.every((e) => completedIds.has(e.id))) continue;
  const input = batch.map((e) => {
    const test =
      e.kind === "oxlint"
        ? path.join(root, "packages", e.pkg, "src/rules", e.name, "rule.test.ts")
        : path.join(root, "packages", e.pkg, "src/checks", e.name + ".test.ts");
    return {
      id: e.id,
      kind: e.kind,
      description: e.rule.meta?.docs ?? e.rule.description,
      examples: existsSync(test) ? read(test).slice(0, 16000) : "",
      docs: e.docs.slice(0, 12000),
    };
  });
  let generated;
  try {
    generated = await cachedJudge(
      "seeds-v3-" + i,
      'Return {"rules":[{"id":string,"cases":[{"file":string,"source":string,"files":{},"options":{}}]}]}. Exactly 2 cases per input rule. Vary its documented violating fixtures deterministically (seed 25102026). For oxlint, file is a realistic relative source filename (preserve test suffix for test-only rules), source is a standalone violating snippet appended to an existing real consumer file; use unique evalSeed identifiers. files are extra fixture files required by rules, options are rule options. For conformance, files maps relative filenames to complete violating manifest/config contents from fixtures, options are conformance options. Never emit node_modules files, fake tool executables, commands, absolute paths or parent traversals. For checks needing tools, seed real source/config violations and allow missing tooling to be reported unsupported. Do not create a fake violation unrelated to the rule. If a rule needs unavailable external tools, still supply its fixture so the evaluation can report unsupported.',
      input,
      0.4,
    );
  } catch (error) {
    if (!/Judge/.test(String(error))) throw error;
    for (const e of batch)
      for (const index of [0, 1])
        results.push({ id: e.id, index, hit: false, error: "Seed generation failed: " + String(error) });
    save("recall", results);
    continue;
  }
  if (generated.rules?.length !== batch.length) throw Error("Invalid seed rule count");
  for (const e of batch) {
    const set = generated.rules.find((s) => s.id === e.id);
    if (set?.cases?.length !== 2) throw Error("Expected two seeds for " + e.id);
    for (const [index, seed] of set.cases.entries()) {
      const repo = Object.keys(repos)[(i + index) % 4];
      results.push(await probeSeed(e, seed, repo, index));
    }
  }
  save("recall", results);
  console.log("seeds", results.length, "/", entries.length * 2);
}
