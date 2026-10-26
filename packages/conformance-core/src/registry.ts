import { migrationSnapshotAncestry } from "./checks/migration-snapshot-ancestry.js";
import { closedDesignSystemProbe } from "./checks/closed-design-system-probe.js";
import { dependencyOverlap } from "./checks/dependency-overlap.js";
import { duplicationBudget } from "./checks/duplication-budget.js";
import { instructionBlocks } from "./checks/instruction-blocks.js";
import { tsconfigStrictness } from "./checks/tsconfig-strictness.js";
import type { ConformanceCheck, ConformanceRunOptions } from "./finding.js";

export const coreChecks: readonly ConformanceCheck[] = [
  dependencyOverlap,
  duplicationBudget,
  closedDesignSystemProbe,
  tsconfigStrictness,
  instructionBlocks,
  migrationSnapshotAncestry,
];

export function activeChecks(options: ConformanceRunOptions): readonly ConformanceCheck[] {
  const skipped = new Set(options.skipChecks ?? []);
  for (const id of skipped)
    if (!coreChecks.some((check) => check.id === id)) throw new Error(`Unknown core conformance check: ${id}`);
  return coreChecks.filter((check) => !skipped.has(check.id));
}
