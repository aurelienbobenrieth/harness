import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord } from "../fs-support.js";

/** Checks Drizzle snapshot id/prevId ancestry in filename order, without rewriting generated evidence. */
export const migrationSnapshotAncestry: ConformanceCheck = {
  id: "migration-snapshot-ancestry",
  description: "Drizzle migration snapshots form one linear id/prevId chain in filename order.",
  docs: "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#migration-snapshot-ancestry",
  async run({ root, migrationSnapshots: options }) {
    if (options === undefined) return [];
    const base = await realpath(root);
    const requested = path.resolve(base, options.directory);
    if (!requested.startsWith(base + path.sep)) throw new Error("Snapshot directory must stay inside the repository.");
    const directory = await realpath(requested);
    if (!directory.startsWith(base + path.sep)) throw new Error("Snapshot directory must stay inside the repository.");
    const files = (await readdir(directory)).filter((file) => /^\d+_snapshot\.json$/.test(file)).toSorted();
    if (!files.length) throw new Error("No migration snapshots found; check the configured directory.");
    const findings: ConformanceFinding[] = [];
    const ids = new Set<string>();
    let previous: string | undefined;
    for (const file of files) {
      const snapshot: unknown = JSON.parse(await readFile(path.join(directory, file), "utf8"));
      if (!isRecord(snapshot) || typeof snapshot.id !== "string" || typeof snapshot.prevId !== "string")
        throw new Error(`Invalid migration snapshot: ${file}`);
      if (ids.has(snapshot.id) || (previous !== undefined && snapshot.prevId !== previous))
        findings.push({
          check: "migration-snapshot-ancestry",
          severity: "warning",
          path: path.relative(root, path.join(directory, file)),
          docs: migrationSnapshotAncestry.docs,
          message:
            "Regenerate this migration from the previous snapshot; snapshot ids must be unique and ancestry linear.",
        });
      ids.add(snapshot.id);
      previous = snapshot.id;
    }
    return findings;
  },
};
