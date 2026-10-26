/* eslint-disable no-await-in-loop -- Compare the fixed rule consistently across pinned consumers. */
import { catalog, load, save, repos, lint, pluginConfig } from "./common.mjs";
const entry = (await catalog()).find((e) => e.id === "effect/no-fake-timers-in-effect-tests");
const rows = load("findings"),
  comparisons = [];
for (const [repo, cwd] of Object.entries(repos)) {
  const row = rows.find((r) => r.id === entry.id && r.repo === repo),
    before = row.findings.length;
  const result = lint(pluginConfig([entry]), cwd, cwd);
  row.findings = result.diagnostics.filter((d) => d.code === "effect(no-fake-timers-in-effect-tests)");
  row.ms = result.ms;
  row.timeScope = "isolated rule wall time";
  row.error = result.error;
  row.crashes = result.crashes;
  comparisons.push({ repo, before, after: row.findings.length, error: result.error });
}
save("findings", rows);
save("fix-comparison", comparisons);
console.log(comparisons);
