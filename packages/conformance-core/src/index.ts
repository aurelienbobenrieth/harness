import type { ConformanceFinding, ConformanceRunOptions } from "./finding.js";
import { activeChecks } from "./registry.js";

export type {
  ClosedDesignSystemOptions,
  ConformanceCheck,
  ConformanceEvaluation,
  ConformanceFinding,
  ConformanceReport,
  ConformanceRunOptions,
  ConformanceSeverity,
  DuplicationOptions,
  InstructionBlocksOptions,
  TsconfigStrictnessOptions,
} from "./finding.js";
export { closedDesignSystemProbe } from "./checks/closed-design-system-probe.js";
export { dependencyOverlap } from "./checks/dependency-overlap.js";
export { duplicationBudget } from "./checks/duplication-budget.js";
export { instructionBlocks } from "./checks/instruction-blocks.js";
export { tsconfigStrictness } from "./checks/tsconfig-strictness.js";
export { activeChecks, coreChecks } from "./registry.js";
export { runCoreConformanceReport } from "./report.js";

export async function runCoreConformance(options: ConformanceRunOptions): Promise<readonly ConformanceFinding[]> {
  const findings: ConformanceFinding[] = [];
  for (const check of activeChecks(options)) {
    findings.push(...(await check.run(options)));
  }
  return findings;
}

export { migrationSnapshotAncestry } from "./checks/migration-snapshot-ancestry.js";
