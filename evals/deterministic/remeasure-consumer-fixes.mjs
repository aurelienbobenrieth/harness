/* eslint-disable no-await-in-loop -- Re-scan fixed detectors and every rule affected by the package crash. */
import { catalog, load, save, repos, lint, pluginConfig } from "./common.mjs";
const entries = await catalog(),
  rows = load("findings"),
  comparison = [];
for (const [repo, cwd] of Object.entries(repos))
  for (const rules of [
    entries.filter((e) => e.pkg === "oxlint-plugin-shopify-app"),
    entries.filter((e) => e.id === "core/no-error-message-matching"),
  ]) {
    const run = lint(pluginConfig(rules), cwd, cwd);
    for (const e of rules) {
      const row = rows.find((r) => r.repo === repo && r.id === e.id),
        before = row.findings.length;
      row.findings = run.diagnostics.filter((d) => d.code === e.id.replace(/\/([^/]+)$/, "($1)"));
      row.error = run.error;
      row.crashes = run.crashes;
      row.ms = run.ms;
      row.timeScope = rules.length === 1 ? "isolated rule wall time" : "shared package wall time";
      comparison.push({
        repo,
        id: e.id,
        before,
        after: row.findings.length,
        crashes: run.crashes.length,
        error: run.error,
      });
    }
  }
save("findings", rows);
save("real-fix-comparison", comparison);
console.log(
  "crashes after fixes",
  comparison.filter((r) => r.crashes || r.error),
);
