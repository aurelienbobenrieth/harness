import { expect, it } from "vitest";
import { defaultOxfmtConfig, defineOxfmtConfig } from "./index.ts";

it("merges overrides without duplicating ignore patterns", () => {
  const config = defineOxfmtConfig({
    ignorePatterns: ["pnpm-lock.yaml", "dist/**"],
    semi: false,
  });

  expect(config.ignorePatterns).toEqual([".agents/**", "**/*.wasm", "pnpm-lock.yaml", "dist/**"]);
  expect(config.semi).toBe(false);
});

it("does not mutate the exported default config", () => {
  defineOxfmtConfig({
    ignorePatterns: ["dist/**"],
    semi: false,
  });

  expect(defaultOxfmtConfig.ignorePatterns).toEqual([".agents/**", "**/*.wasm", "pnpm-lock.yaml"]);
  expect(defaultOxfmtConfig.semi).toBe(true);
});
