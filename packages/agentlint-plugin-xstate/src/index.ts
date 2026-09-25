import { defineConfig } from "@aurelienbbn/agentlint";
import { actorCleanup } from "./rules/actor-cleanup/rule.js";
import { derivedBooleanContext } from "./rules/derived-boolean-context/rule.js";
import { machineFailureCoverage } from "./rules/machine-failure-coverage/rule.js";
import { persistedSnapshotCompat } from "./rules/persisted-snapshot-compat/rule.js";
import { spawnedActorRelease } from "./rules/spawned-actor-release/rule.js";

export { actorCleanup, defineActorCleanup, type ActorCleanupOptions } from "./rules/actor-cleanup/rule.js";
export {
  defineDerivedBooleanContext,
  derivedBooleanContext,
  type DerivedBooleanContextOptions,
} from "./rules/derived-boolean-context/rule.js";
export {
  defineMachineFailureCoverage,
  machineFailureCoverage,
  type MachineFailureCoverageOptions,
} from "./rules/machine-failure-coverage/rule.js";
export {
  definePersistedSnapshotCompat,
  persistedSnapshotCompat,
  type PersistedSnapshotCompatOptions,
} from "./rules/persisted-snapshot-compat/rule.js";
export {
  defineSpawnedActorRelease,
  spawnedActorRelease,
  type SpawnedActorReleaseOptions,
} from "./rules/spawned-actor-release/rule.js";

export const xstatePreset = defineConfig({
  rules: [actorCleanup, derivedBooleanContext, machineFailureCoverage, persistedSnapshotCompat, spawnedActorRelease],

  ignores: ["**/*.d.ts"],
});

/** Small, explicitly selected starting point. Calibrate its scope before enforcing it.
 * @attribution desloppify by Peter O'Malley (workflow inspiration only; independently implemented)
 */
export const starterPreset = defineConfig({
  rules: [actorCleanup, machineFailureCoverage],
  ignores: ["**/*.d.ts"],
});
