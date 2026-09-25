import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineProtectedInvariantChange, protectedInvariantChange } from "./rule.js";

const privacyRule = defineProtectedInvariantChange({
  invariants: [
    {
      id: "biometrics/client-only",
      statement: "Raw biometric data never reaches a server.",
      protectedPaths: [/^src\/biometrics\//g, /^src\/server\/uploads\//],
      evidencePaths: [/^test\/privacy-contract\./],
    },
  ],
});

it("reports a protected source or evidence change with human authority", async () => {
  const results = await Promise.all(
    ["src/biometrics/matting.ts", "test/privacy-contract.test.ts"].map((path) =>
      testRuleOnChange({
        rule: privacyRule,
        fixture: { before: { [path]: "export const value = 1;\n" }, after: { [path]: "export const value = 2;\n" } },
      }),
    ),
  );
  for (const findings of results)
    expect(findings.map((finding) => [finding.authority, finding.lineageKey])).toEqual([
      ["human", "biometrics/client-only"],
    ]);
});

it("stays silent outside configured surfaces and when no invariant is configured", async () => {
  const fixture = { before: {}, after: { "src/catalog.ts": "export const value = 1;\n" } };
  expect(await testRuleOnChange({ rule: privacyRule, fixture })).toEqual([]);
  expect(await testRuleOnChange({ rule: protectedInvariantChange, fixture })).toEqual([]);
});

it("rejects ambiguous invariant configuration", () => {
  expect(() =>
    defineProtectedInvariantChange({
      invariants: [{ id: "privacy", statement: "Client only", protectedPaths: [] }],
    }),
  ).toThrow("needs at least one protected path");
  expect(() =>
    defineProtectedInvariantChange({
      invariants: [
        { id: "privacy", statement: "Client only", protectedPaths: [/src/] },
        { id: "privacy", statement: "Still client only", protectedPaths: [/app/] },
      ],
    }),
  ).toThrow("duplicate id privacy");
});
