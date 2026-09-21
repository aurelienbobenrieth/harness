import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { definePersistedSnapshotCompat, persistedSnapshotCompat } from "./rule.js";

it("reports a persisted snapshot", async () => {
  const source = 'actor.subscribe(() => localStorage.setItem("cart", JSON.stringify(actor.getPersistedSnapshot())));';
  const findings = await testRuleOnSource(persistedSnapshotCompat, source, "src/persist.ts");

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("Snapshot persisted");
});

it("reports createActor restored from a stored snapshot", async () => {
  const source = 'const actor = createActor(cartMachine, { snapshot: JSON.parse(localStorage.getItem("cart")) });';
  const findings = await testRuleOnSource(persistedSnapshotCompat, source, "src/restore.ts");

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("Actor restored");
});

it("reports React hooks restoring a snapshot, including the shorthand property", async () => {
  const source = `
const [state, send] = useMachine(cartMachine, { snapshot });
const ref = useActorRef(cartMachine, { "snapshot": restored, input: { id } });
`;
  await expect(testRuleOnSource(persistedSnapshotCompat, source, "src/cart.tsx")).resolves.toHaveLength(2);
});

it("stays silent on fresh actors and on snapshot reads", async () => {
  const source = `
const actor = createActor(cartMachine, { input: { id } });
const bare = createActor(cartMachine);
const snapshot = actor.getSnapshot();
const [state] = useMachine(cartMachine, { input: { snapshot } });
`;
  await expect(testRuleOnSource(persistedSnapshotCompat, source, "src/cart.tsx")).resolves.toEqual([]);
});

it("stays silent when a snapshot key is passed to an unrelated call or as the first argument", async () => {
  const source = `
render(view, { snapshot: actor.getSnapshot() });
createActor({ snapshot: 1 }, { input: {} });
`;
  await expect(testRuleOnSource(persistedSnapshotCompat, source, "src/view.ts")).resolves.toEqual([]);
});

it("excludes test files by default and honours configured callee patterns", async () => {
  expect(persistedSnapshotCompat.binding.exclude).toContain("**/*.{test,spec}.*");

  const rule = definePersistedSnapshotCompat({ restoreCalleePattern: /^restoreActor$/ });
  const source = "restoreActor(machine, { snapshot }); createActor(machine, { snapshot });";

  await expect(testRuleOnSource(rule, source, "src/m.ts")).resolves.toHaveLength(1);
});
