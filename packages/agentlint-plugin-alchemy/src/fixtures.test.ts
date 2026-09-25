import { testRuleFixtures } from "@aurelienbbn/agentlint/testing";
import type { AgentlintRule } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import * as plugin from "./index.js";

const rules = Object.values(plugin).filter(
  (value): value is AgentlintRule => typeof value === "object" && value !== null && "lifecycle" in value,
);

it("exports every rule folder", () => {
  expect(rules.map((rule) => rule.standard.id).toSorted()).toEqual([
    "alchemy/adopt-review",
    "alchemy/init-config-exposure",
    "alchemy/removal-policy-change",
    "alchemy/removal-policy-review",
    "alchemy/resource-replacement-review",
    "alchemy/state-store-change",
  ]);
});

for (const rule of rules) {
  it(rule.binding.id + " activates and stays silent through the real parser", async () => {
    const report = await testRuleFixtures(rule);
    expect(report.total).toBeGreaterThan(0);
    expect(report.failures).toEqual([]);
  });
}
