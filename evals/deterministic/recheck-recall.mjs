/* eslint-disable no-await-in-loop -- Seed probes run sequentially to bound native lint processes. */
import { catalog, load, save } from "./common.mjs";
import { probeSeed } from "./seed-probe.mjs";
const entries = await catalog(),
  raw = load("recall"),
  results = [];
for (const row of raw) {
  results.push(
    row.seed
      ? await probeSeed(
          entries.find((e) => e.id === row.id),
          row.seed,
          row.repo,
          row.index,
        )
      : row,
  );
  if (results.length % 20 === 0) console.log("rechecked", results.length, "/", raw.length);
}
save("recall", results);
