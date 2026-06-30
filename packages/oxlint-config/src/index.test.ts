import { expect, it } from "vitest";
import { defineStrictOxlintConfig, strictOxlintConfig } from "./index.ts";

it("merges overrides without duplicating list entries", () => {
  const config = defineStrictOxlintConfig({
    ignorePatterns: ["dist/**", "dist/**"],
    plugins: ["typescript", "import"],
    rules: {
      "typescript/no-explicit-any": "warn",
    },
  });

  expect(config.ignorePatterns).toEqual(["dist/**"]);
  expect(config.plugins).toEqual(["eslint", "typescript", "unicorn", "vitest", "node", "promise", "import"]);
  expect(config.rules?.["typescript/no-explicit-any"]).toBe("warn");
});

it("does not mutate the exported strict config", () => {
  defineStrictOxlintConfig({
    plugins: ["import"],
    rules: {
      "typescript/no-explicit-any": "warn",
    },
  });

  expect(strictOxlintConfig.plugins).toEqual(["eslint", "typescript", "unicorn", "vitest", "node", "promise"]);
  expect(strictOxlintConfig.rules["typescript/no-explicit-any"]).toBe("error");
});
