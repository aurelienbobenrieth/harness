import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { definePersistedSnapshotCompat, persistedSnapshotCompat } from "./rule.js";

it("reports a persisted snapshot", async () => {
  const source = 'actor.subscribe(() => localStorage.setItem("cart", JSON.stringify(actor.getPersistedSnapshot())));';
  const findings = await testRuleOnSource({
    rule: persistedSnapshotCompat,
    source: source,
    file: "src/persist.ts",
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("Snapshot persisted");
});

it("reports createActor restored from a stored snapshot", async () => {
  const source = 'const actor = createActor(cartMachine, { snapshot: JSON.parse(localStorage.getItem("cart")) });';
  const findings = await testRuleOnSource({
    rule: persistedSnapshotCompat,
    source: source,
    file: "src/restore.ts",
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("Actor restored");
});

it("reports React hooks restoring a snapshot, including the shorthand property", async () => {
  const source = `
const [state, send] = useMachine(cartMachine, { snapshot });
const ref = useActorRef(cartMachine, { "snapshot": restored, input: { id } });
`;
  await expect(
    testRuleOnSource({ rule: persistedSnapshotCompat, source: source, file: "src/cart.tsx" }),
  ).resolves.toHaveLength(2);
});

it("stays silent on fresh actors and on snapshot reads", async () => {
  const source = `
const actor = createActor(cartMachine, { input: { id } });
const bare = createActor(cartMachine);
const snapshot = actor.getSnapshot();
const [state] = useMachine(cartMachine, { input: { snapshot } });
`;
  await expect(
    testRuleOnSource({ rule: persistedSnapshotCompat, source: source, file: "src/cart.tsx" }),
  ).resolves.toEqual([]);
});

it("stays silent when a snapshot key is passed to an unrelated call or as the first argument", async () => {
  const source = `
render(view, { snapshot: actor.getSnapshot() });
createActor({ snapshot: 1 }, { input: {} });
`;
  await expect(
    testRuleOnSource({ rule: persistedSnapshotCompat, source: source, file: "src/view.ts" }),
  ).resolves.toEqual([]);
});

it("excludes test files by default and honours configured callee patterns", async () => {
  expect(persistedSnapshotCompat.binding.exclude).toContain("**/*.{test,spec}.*");

  const rule = definePersistedSnapshotCompat({ restoreCalleePattern: /^restoreActor$/ });
  const source = "restoreActor(machine, { snapshot }); createActor(machine, { snapshot });";

  await expect(testRuleOnSource({ rule: rule, source: source, file: "src/m.ts" })).resolves.toHaveLength(1);
});

it("reports v6 persistence with embedChildren and a migrated restore through system.createActor", async () => {
  const source = `
import { createSystem, machineVersions } from "xstate";

const persisted = actor.getPersistedSnapshot({ embedChildren: false });
localStorage.setItem("checkout", JSON.stringify(persisted));

const versions = machineVersions([checkoutV1, checkoutV2]);
const snapshot = await versions.migrateSnapshot(JSON.parse(raw), { to: "2" });
const system = createSystem({ registry: {} });
const restored = system.createActor(checkoutV2, { snapshot, registryKey: "checkout" }).start();
`;
  const findings = await testRuleOnSource({ rule: persistedSnapshotCompat, source: source, file: "src/persist.ts" });

  expect(findings.map((finding) => [finding.line, finding.message.split(":")[0]])).toEqual([
    [4, "Snapshot persisted"],
    [10, "Actor restored from a stored snapshot"],
  ]);
});

it("states that a restore never throws and covers v6 migration, inline children and Effect actors", () => {
  const guidance = persistedSnapshotCompat.standard.guidance;
  const text = typeof guidance === "object" ? [guidance.standard, ...(guidance.checks ?? [])].join("\n") : guidance;

  expect(text).toContain("does not throw at createActor(...)");
  expect(text).not.toContain("throws at actor creation");
  expect(text).toContain("machineVersions(...).migrateSnapshot(...)");
  expect(text).toContain("An inline child actor cannot be persisted.");
  expect(text).toContain("createEffectActor(...) cannot be restored");
});
