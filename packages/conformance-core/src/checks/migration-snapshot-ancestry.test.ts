import { expect, it } from "vitest";
import { migrationSnapshotAncestry } from "./migration-snapshot-ancestry.js";
import { createFixture } from "./test-support.js";

const snapshot = (id: string, prevId: string) => JSON.stringify({ id, prevId });
it("reports sibling migration snapshots instead of a linear chain", async () => {
  const root = await createFixture({
    "meta/0000_snapshot.json": snapshot("a", "00000000-0000-0000-0000-000000000000"),
    "meta/0001_snapshot.json": snapshot("b", "a"),
    "meta/0002_snapshot.json": snapshot("c", "a"),
  });
  const findings = await migrationSnapshotAncestry.run({
    root,
    migrationSnapshots: { directory: "meta" },
  });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toMatch(/previous snapshot/);
  expect(findings[0]?.severity).toBe("warning");
});
it("accepts linear snapshots and stays silent without opt-in", async () => {
  const root = await createFixture({
    "meta/0000_snapshot.json": snapshot("a", "00000000-0000-0000-0000-000000000000"),
    "meta/0001_snapshot.json": snapshot("b", "a"),
  });
  expect(await migrationSnapshotAncestry.run({ root, migrationSnapshots: { directory: "meta" } })).toEqual([]);
  expect(await migrationSnapshotAncestry.run({ root })).toEqual([]);
});
it("rejects missing, empty and malformed evidence and paths outside the repo", async () => {
  const root = await createFixture({ "bad/0000_snapshot.json": "{}" });
  await expect(migrationSnapshotAncestry.run({ root, migrationSnapshots: { directory: "missing" } })).rejects.toThrow(
    /ENOENT/,
  );
  await expect(migrationSnapshotAncestry.run({ root, migrationSnapshots: { directory: "bad" } })).rejects.toThrow(
    /Invalid/,
  );
  await expect(
    migrationSnapshotAncestry.run({ root, migrationSnapshots: { directory: "../outside" } }),
  ).rejects.toThrow(/inside/);
});
