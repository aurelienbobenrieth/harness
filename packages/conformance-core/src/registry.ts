import { closedDesignSystemProbe } from "./checks/closed-design-system-probe.js";
import { deadExports } from "./checks/dead-exports.js";
import { dependencyOverlap } from "./checks/dependency-overlap.js";
import { duplicationBudget } from "./checks/duplication-budget.js";
import { tsconfigStrictness } from "./checks/tsconfig-strictness.js";
import type { ConformanceCheck, ConformanceRunOptions } from "./finding.js";

export const coreChecks: readonly ConformanceCheck[] = [
  dependencyOverlap,
  duplicationBudget,
  deadExports,
  closedDesignSystemProbe,
  tsconfigStrictness,
];

export function activeChecks(options: ConformanceRunOptions): readonly ConformanceCheck[] {
  const skipped = new Set(options.skipChecks ?? []);
  for (const id of skipped)
    if (!coreChecks.some((check) => check.id === id)) throw new Error(`Unknown core conformance check: ${id}`);
  return coreChecks.filter((check) => !skipped.has(check.id));
}
