/* eslint-disable no-await-in-loop -- Keep package inventory generation and failure attribution in a deterministic order. */
import assert from "node:assert/strict";
import { readFile, readdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const write = process.argv.includes("--write");
const start = "<!-- harness-catalog:start -->";
const end = "<!-- harness-catalog:end -->";
const canonical = (text) => text.replaceAll(/\s+/g, "").replaceAll(/(?<=\|)-{3,}(?=\|)/g, "---");
const rows = [];
const repository = JSON.parse(await readFile(path.join(root, "policy/release.json"), "utf8")).repository;
function validateDocs(source, label) {
  for (const match of source.matchAll(/https:\/\/github\.com\/([^/\s"'`]+\/harness)(?=[/#\s"'`]|$)/g))
    assert.equal(match[1], repository, `${label}: documentation URL must use the canonical repository`);
}
let ruleCount = 0;
let checkCount = 0;
for (const directory of (await readdir(path.join(root, "packages"))).toSorted()) {
  const folder = path.join(root, "packages", directory);
  const manifest = JSON.parse(await readFile(path.join(folder, "package.json"), "utf8"));
  assert.equal(manifest.license, "MIT", `${directory}: license metadata`);
  assert.equal(
    await readFile(path.join(folder, "LICENSE"), "utf8"),
    await readFile(path.join(root, "LICENSE"), "utf8"),
    `${directory}: license text`,
  );
  assert.equal(manifest.repository.directory, `packages/${directory}`);
  assert.ok(manifest.scripts.typecheck, `${directory}: source typecheck gate`);
  for (const target of Object.values(manifest.exports).flatMap((entry) =>
    typeof entry === "string" ? [entry] : Object.values(entry),
  ))
    await access(path.join(folder, target));
  const module = await import(pathToFileURL(path.join(folder, "dist/index.mjs")).href);
  const entries = new Map();
  if (directory.startsWith("oxlint-plugin-"))
    for (const [id, rule] of Object.entries(module.default.rules)) entries.set(id, rule.meta?.docs?.description ?? "");
  if (directory.startsWith("agentlint-plugin-"))
    for (const value of Object.values(module))
      if (value?.standard?.id && value?.detector && value?.binding)
        entries.set(value.standard.id.split("/").at(-1), value.standard.summary);
  if (directory.startsWith("stylelint-plugin-"))
    for (const plugin of module.default)
      entries.set(
        plugin.ruleName.split("/").at(-1),
        plugin.rule.meta?.description ?? `Enforce the ${plugin.ruleName.split("/").at(-1)} CSS policy.`,
      );
  if (directory.startsWith("conformance-"))
    for (const value of Object.values(module))
      if (value?.id && typeof value.run === "function") entries.set(value.id, value.description);
  const isCheck = directory.startsWith("conformance-");
  const readmePath = path.join(folder, "README.md");
  const original = await readFile(readmePath, "utf8");
  const attributions = new Set();
  if (directory.includes("-plugin-")) {
    for (const entry of await readdir(path.join(folder, "src/rules"), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!(await readdir(path.join(folder, "src/rules", entry.name))).includes("rule.ts")) continue;
      assert.ok(entries.has(entry.name), `${directory}/${entry.name}: rule folder is not exported`);
      const source = await readFile(path.join(folder, "src/rules", entry.name, "rule.ts"), "utf8");
      validateDocs(source, `${directory}/${entry.name}`);
      for (const match of source.matchAll(/@attribution\s+([^\r\n]+)/g))
        attributions.add(match[1].replace(/\s*\*\/$/u, "").trim());
    }
  } else if (isCheck) {
    for (const entry of await readdir(path.join(folder, "src/checks"))) {
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts") || entry === "test-support.ts") continue;
      const source = await readFile(path.join(folder, "src/checks", entry), "utf8");
      validateDocs(source, `${directory}/${entry}`);
      for (const match of source.matchAll(/@attribution\s+([^\r\n]+)/g))
        attributions.add(match[1].replace(/\s*\*\/$/u, "").trim());
    }
  }
  if (entries.size > 0) {
    const inventory = [
      `${start}`,
      "",
      "## Registered contract inventory",
      "",
      "Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.",
      "",
      "| Rule/check | Trigger or review scope |",
      "| --- | --- |",
    ];
    for (const [id, description] of [...entries].toSorted(([a], [b]) => a.localeCompare(b))) {
      assert.ok(description?.length > 0, `${directory}/${id}: missing description`);
      const fileId = id;
      const test = isCheck ? `src/checks/${fileId}.test.ts` : `src/rules/${id}/rule.test.ts`;
      await access(path.join(folder, test));
      const testSource = await readFile(path.join(folder, test), "utf8");
      if (directory.startsWith("oxlint-plugin-")) {
        assert.match(testSource, /\bassertRuleReports\b/u, `${directory}/${id}: missing positive test case`);
        assert.match(testSource, /\bassertRuleDoesNotReport\b/u, `${directory}/${id}: missing negative test case`);
      }
      if (directory.startsWith("agentlint-plugin-")) {
        const ruleSource = await readFile(path.join(folder, `src/rules/${id}/rule.ts`), "utf8");
        assert.match(ruleSource, /\bmustReport\s*:/u, `${directory}/${id}: missing mustReport fixture`);
        assert.match(ruleSource, /\bmustStaySilent\s*:/u, `${directory}/${id}: missing mustStaySilent fixture`);
      }
      if (isCheck) {
        assert.match(
          testSource,
          /toHaveLength\([1-9]\d*\)|\.severity\)|\.message\)/u,
          `${directory}/${id}: missing finding assertion`,
        );
        assert.match(testSource, /toEqual\(\[\]\)|toHaveLength\(0\)/u, `${directory}/${id}: missing passing assertion`);
      }
      inventory.push(`| \`${id}\` | ${description.replaceAll("|", "\\|").replaceAll(/\s+/g, " ")} |`);
    }
    if (attributions.size > 0)
      inventory.push("", "### Credited concepts", "", ...[...attributions].toSorted().map((credit) => `- ${credit}`));
    inventory.push("", end);
    const generated = inventory.join("\n");
    const current = original.replaceAll("\r\n", "\n");
    const begin = current.indexOf(start);
    const finish = current.indexOf(end);
    const next =
      begin < 0
        ? `${current.trimEnd()}\n\n${generated}\n`
        : current.slice(0, begin) + generated + current.slice(finish + end.length);
    if (write) await writeFile(readmePath, next);
    else
      assert.ok(canonical(current) === canonical(next), `${directory}: stale catalog; run pnpm catalog and pnpm fmt`);
    if (isCheck) checkCount += entries.size;
    else ruleCount += entries.size;
  }
  rows.push(`${directory}: ${entries.size || "configuration/CLI"}`);
}
console.log(
  `Validated ${rows.length} packages, ${ruleCount} rules, ${checkCount} checks, positive/negative contracts, export artifacts, and license metadata.`,
);
