import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineHotspotChangeReview, hotspotChangeReview } from "./rule.js";

const rule = defineHotspotChangeReview({
  hotspots: [
    {
      id: "order-reconciliation",
      pathPattern: /^src\/orders\/reconcile/g,
      evidence: "Repeated partial-failure corrections require sequence review.",
    },
  ],
});

it("reports configured hotspot changes with their historical evidence", async () => {
  const findings = await testRuleOnChange({
    rule,
    fixture: {
      before: { "src/orders/reconcile.ts": "export const steps = 2;\n" },
      after: { "src/orders/reconcile.ts": "export const steps = 3;\n" },
    },
  });
  expect(findings.map((finding) => [finding.authority, finding.lineageKey, finding.file])).toEqual([
    ["human", "order-reconciliation", "src/orders/reconcile.ts"],
  ]);
});

it("stays silent outside configured hotspots and without configuration", async () => {
  const fixture = { before: {}, after: { "src/orders/create.ts": "export const value = 1;\n" } };
  expect(await testRuleOnChange({ rule, fixture })).toEqual([]);
  expect(await testRuleOnChange({ rule: hotspotChangeReview, fixture })).toEqual([]);
});

it("rejects duplicate hotspot identities", () => {
  expect(() =>
    defineHotspotChangeReview({
      hotspots: [
        { id: "orders", pathPattern: /a/, evidence: "first" },
        { id: "orders", pathPattern: /b/, evidence: "second" },
      ],
    }),
  ).toThrow("duplicate id orders");
});
