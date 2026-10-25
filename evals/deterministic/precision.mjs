/* eslint-disable no-await-in-loop -- Sequential scans and judge calls bound memory and share one cost ledger. */
import { catalog, load, save, repos, excerpt } from "./common.mjs";
import { createHash } from "node:crypto";
import { cachedJudge } from "./judge.mjs";
const position = (f) => [
  f.filename ?? f.path ?? f.file ?? "",
  f.labels?.[0]?.span?.offset ?? f.line ?? 0,
  f.message ?? "",
];

const entries = await catalog(),
  rows = load("findings"),
  samples = [];
for (const row of rows) {
  const e = entries.find(
    (candidate) => candidate.pkg === row.pkg && (candidate.id === row.id || "agentlint/" + candidate.id === row.id),
  );
  const eligible = row.findings
    .filter((f) => !f.evaluation)
    .toSorted((a, b) => JSON.stringify(position(a)).localeCompare(JSON.stringify(position(b))));
  // Stable first and middle findings cover more than one position without sampling randomness.
  for (const index of new Set([0, Math.floor(eligible.length / 2)])) {
    const finding = eligible[index];
    if (!finding) continue;
    samples.push({
      key: row.repo + ":" + row.id + ":" + index,
      id: row.id,
      repo: row.repo,
      doc: e?.kind === "oxlint" ? e.rule.meta?.docs : (e?.rule.standard ?? e?.rule.description),
      finding,
      code: excerpt(repos[row.repo], finding),
    });
  }
}
const calibration = await cachedJudge(
  "precision-calibration-v3",
  'Return {"grades":[{"key":string,"grade":"true-positive"|"false-positive"}]}. Judge the finding, not code quality: true-positive means the code violates the supplied rule, false-positive means it does not.',
  [
    { key: "mutable", rule: "Disallow let declarations", code: "let count = 0;", finding: "Avoid let" },
    { key: "immutable", rule: "Disallow let declarations", code: "const count = 0;", finding: "Avoid let" },
  ],
  0.1,
);
if (
  calibration.grades?.find((g) => g.key === "mutable")?.grade !== "true-positive" ||
  calibration.grades?.find((g) => g.key === "immutable")?.grade !== "false-positive"
)
  throw Error("Judge failed precision orientation calibration");
const graded = [];
for (let i = 0; i < samples.length; i += 20) {
  const batch = samples.slice(i, i + 20);
  let result = await cachedJudge(
    "precision-v2-" + i + "-" + createHash("sha256").update(JSON.stringify(batch)).digest("hex").slice(0, 12),
    'Return {"grades":[{"key":string,"grade":"true-positive"|"false-positive"|"debatable","reason":string}]}. A TRUE POSITIVE means the finding is correct: the supplied code violates this rule. A FALSE POSITIVE means the finding is incorrect: the code does not violate this rule or the rule does not apply to this file. DEBATABLE means evidence is insufficient. A categorical rule such as no-let is a true positive whenever let occurs, even when mutation is intentional or necessary. Do not judge whether you personally like a rule. The reason MUST agree with the label: if the reason says the rule is violated, use true-positive. Grade every supplied finding against its rule doc and excerpt. Missing context, intentional platform code, and design preferences with ambiguous applicability are debatable; do not infer violations from the message alone.',
    batch,
    0.25,
  );
  const allowed = new Set(["true-positive", "false-positive", "debatable"]);
  if (!Array.isArray(result.grades)) throw Error("Judge returned no grades");
  const repaired = [];
  for (const sample of batch) {
    const matches = result.grades.filter((g) => g.key === sample.key && allowed.has(g.grade));
    if (matches.length === 1) repaired.push(matches[0]);
    else {
      const value = await cachedJudge(
        "precision-key-repair-" + createHash("sha256").update(JSON.stringify(sample)).digest("hex").slice(0, 16),
        'Return {"grade":"true-positive"|"false-positive"|"debatable","reason":string}. True-positive means this finding is correct because the code violates the rule. False-positive means it is incorrect or out of scope. Debatable means insufficient evidence. Judge only the supplied sample.',
        sample,
        0.15,
      );
      if (!allowed.has(value.grade)) throw Error("Invalid repaired precision grade");
      repaired.push({ ...value, key: sample.key });
    }
  }
  result = { grades: repaired };
  graded.push(...result.grades);
  save("precision", { samples, grades: graded });
  console.log("graded", graded.length, "/", samples.length);
}
