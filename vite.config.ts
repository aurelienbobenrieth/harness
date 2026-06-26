import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    categories: {
      correctness: "error",
      perf: "error",
      suspicious: "error",
    },
    env: {
      builtin: true,
      node: true,
    },
    plugins: ["typescript", "node", "unicorn", "vitest"],
    ignorePatterns: ["packages/*/dist/**"],
    rules: {
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "jest/no-conditional-expect": "off",
      "jest/valid-expect": "off",
      "jest/no-standalone-expect": "off",
      "jest/expect-expect": "off",
    },
  },
  fmt: {
    printWidth: 120,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    tabWidth: 2,
    arrowParens: "always",
    sortPackageJson: true,
    ignorePatterns: ["package-lock.json"],
  },
  test: {
    include: ["src/**/*.test.ts"],
    pool: "forks",
    testTimeout: 15_000,
  },
});
