import { testRuleFixtures } from "@aurelienbbn/agentlint/testing";
import type { AgentlintRule } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import * as plugin from "./index.js";
for (const value of Object.values(plugin)) {
  if (typeof value !== "object" || value === null || !("lifecycle" in value)) continue;
  const rule = value as AgentlintRule;
  if (!rule.detector.fixtures) continue;
  it(rule.binding.id + " activates and stays silent through the real parser", async () => {
    const report = await testRuleFixtures(rule);
    expect(report.total).toBeGreaterThan(0);
    expect(report.failures).toEqual([]);
  });
}
