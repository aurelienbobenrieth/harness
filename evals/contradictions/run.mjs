import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { files, root, results, options, fixture, skillFiles } from "../lib/io.mjs";
import { judge, budget } from "../lib/runner.mjs";

const opts = options(),
  output = await results("contradictions");
const sources = await skillFiles(opts["skills-ref"]);
const corpus = [path.join(root, "AGENTS.md")];
for (const extra of opts.include) corpus.push(...((await stat(extra)).isDirectory() ? await files(extra) : [extra]));
const documents = sources
  .filter((s) => /\.(md|txt|ya?ml)$/.test(s.file))
  .map((s) => ({
    file: s.file,
    text: s.text
      .split(/\r?\n/)
      .map((line, i) => `${i + 1}: ${line}`)
      .join("\n"),
  }));
for (const file of [...new Set(corpus)].filter((p) => /\.(md|txt|ya?ml)$/.test(p))) {
  const text = await readFile(file, "utf8");
  documents.push({
    file: path.relative(root, file).replaceAll("\\", "/"),
    text: text
      .split(/\r?\n/)
      .map((line, i) => `${i + 1}: ${line}`)
      .join("\n"),
  });
}
// Every document appears in both calls: partitioned chunks would miss cross-chunk conflicts.
const rubric = `Audit all steering statements, including quoted examples in their proper context. Distinguish hard conflicts (same situation requires incompatible actions) from soft tensions and intentional duplicates such as installed core blocks. Return {"findings":[{"kind":"hard|soft|duplicate","a":{"file":"exact input path","line":1},"b":{"file":"exact input path","line":1},"conflict":"explanation","resolution":"suggested resolution"}]}. Report every pair you find. Do not treat specialization or examples as hard conflicts.`;
const workspace = await fixture(undefined, opts["skills-ref"]);
try {
  const findings = [];
  for (const focus of [
    "Find candidate conflicts and duplicates across all files.",
    "Audit previous candidates skeptically and find any missed pairs. Return the final findings list. Permission already granted can satisfy an authorization rule. A maximum is not a mandatory minimum. Apply explicit exceptions and instruction precedence; compatible specialization is not hard. Remove false positives and consolidate repeated pairs.",
  ]) {
    const { value, run } = await judge({
      rubric: rubric + "\nFocus: " + focus,
      input: { documents, previousCandidates: findings },
      cwd: workspace.cwd,
      maxUsd: 0.75,
    });
    if (!Array.isArray(value.findings)) throw new Error("Invalid findings shape");
    const validated = [];
    for (const f of value.findings) {
      if (!["hard", "soft", "duplicate"].includes(f.kind)) throw new Error("Invalid finding kind");
      for (const ref of [f.a, f.b]) {
        const doc = documents.find((d) => d.file === ref?.file);
        if (!doc || !Number.isInteger(ref.line) || ref.line < 1 || ref.line > doc.text.split("\n").length)
          throw new Error("Invalid finding citation");
      }
      if (typeof f.conflict !== "string" || typeof f.resolution !== "string") throw new Error("Missing explanation");
      const key = JSON.stringify(
        [f.a, f.b].toSorted((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`)),
      );
      if (!validated.some((g) => g.key === key && g.kind === f.kind)) validated.push({ ...f, key });
    }
    findings.splice(0, findings.length, ...validated);
    await output.record({ focus, ...value, run });
  }
  const hard = findings.filter((f) => f.kind === "hard").length;
  const summary =
    `# Contradictions\n\n${documents.length} files; ${hard} hard conflicts; ${findings.filter((f) => f.kind === "soft").length} soft tensions; ${findings.filter((f) => f.kind === "duplicate").length} duplicate pairs.\nEstimated cost: $${budget.spent.toFixed(4)}.\n\n` +
    findings
      .map(
        (f) =>
          `- **${f.kind}** ${f.a.file}:${f.a.line} / ${f.b.file}:${f.b.line}: ${f.conflict} Resolution: ${f.resolution}`,
      )
      .join("\n");
  await output.summary(summary);
  console.log(summary);
  process.exitCode = hard ? 1 : 0;
} catch (error) {
  await output.record({ error: error.message, run: error.run });
  await output.summary(
    `# Contradictions incomplete\n\n${error.message}\nEstimated cost: $${budget.spent.toFixed(4)}\n`,
  );
  console.error(error.message);
  process.exitCode = 2;
} finally {
  await workspace.cleanup();
}
