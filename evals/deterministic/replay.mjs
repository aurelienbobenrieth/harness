/* eslint-disable no-await-in-loop -- Replay fixed seeds without model calls or concurrent lint processes. */
import { readFileSync } from "node:fs";
import { catalog, save } from "./common.mjs";
import { probeSeed } from "./seed-probe.mjs";
const cases = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8"));
const entries = await catalog(),
  results = [];
for (const row of cases) {
  if (!row.seed) {
    results.push(row);
    continue;
  }
  const entry = entries.find((e) => e.id === row.id);
  if (!entry) throw Error("Unknown fixture rule: " + row.id);
  results.push(await probeSeed(entry, row.seed, row.repo, row.index));
}
save("recall", results);
console.log("Replayed", results.length, "fixed seeded variants without model calls");
