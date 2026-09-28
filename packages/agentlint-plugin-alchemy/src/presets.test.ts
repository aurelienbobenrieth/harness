import { defineConfig } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { initConfigExposure, starterPreset, strictPreset } from "./index.js";

it("keeps the opt-in rule out of both presets and the starter inside the strict preset", () => {
  const strict = (strictPreset.rules ?? []).map((rule) => rule.binding.id);
  const starter = (starterPreset.rules ?? []).map((rule) => rule.binding.id);
  expect(strict).not.toContain(initConfigExposure.binding.id);
  expect(starter).toEqual(["alchemy/resource-replacement-review", "alchemy/state-store-change"]);
  expect(starter.every((id) => strict.includes(id))).toBe(true);
  expect([strictPreset.ignores, starterPreset.ignores]).toEqual([["**/*.d.ts"], ["**/*.d.ts"]]);
});

it("reserves change gates and adoption for human authority", () => {
  expect((strictPreset.rules ?? []).map((rule) => [rule.binding.id, rule.lifecycle, rule.binding.authority])).toEqual([
    ["alchemy/resource-replacement-review", "change", "human"],
    ["alchemy/removal-policy-review", "state", "agent"],
    ["alchemy/removal-policy-change", "change", "human"],
    ["alchemy/state-store-change", "change", "human"],
    ["alchemy/adopt-review", "state", "human"],
  ]);
});

it("composes the strict preset with the opt-in rule in one config", () => {
  expect(() => defineConfig({ extends: [strictPreset], rules: [initConfigExposure] })).not.toThrow();
});
