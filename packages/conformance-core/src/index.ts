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
  DeadExportsOptions,
  DuplicationOptions,
  TsconfigStrictnessOptions,
} from "./finding.js";
export { closedDesignSystemProbe } from "./checks/closed-design-system-probe.js";
export { deadExports } from "./checks/dead-exports.js";
export { dependencyOverlap } from "./checks/dependency-overlap.js";
export { duplicationBudget } from "./checks/duplication-budget.js";
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
