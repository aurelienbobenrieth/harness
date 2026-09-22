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
    plugins: ["typescript", "node", "unicorn", "vitest", "import"],
    ignorePatterns: ["packages/*/dist/**", ".tmp/**", ".stryker-tmp/**", "local-packages/**"],
    rules: {
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "import/no-cycle": "error",
      "import/no-self-import": "error",
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "jest/no-conditional-expect": "off",
      "jest/valid-expect": "off",
      "jest/no-standalone-expect": "off",
      "vitest/expect-expect": [
        "error",
        { assertFunctionNames: ["expect", "assertRuleReports", "assertRuleDoesNotReport"] },
      ],
    },
    overrides: [
      {
        // Conformance checks are ordered filesystem walks with early exits;
        // sequential awaits are intentional there.
        files: ["packages/conformance-*/src/**"],
        rules: {
          "eslint/no-await-in-loop": "off",
        },
      },
    ],
  },
  fmt: {
    printWidth: 120,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    tabWidth: 2,
    arrowParens: "always",
    sortPackageJson: true,
    ignorePatterns: ["package-lock.json", ".tmp/**", "local-packages/**"],
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    pool: "forks",
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: [
        "packages/agentlint-plugin-*/src/**/*.ts",
        "packages/conformance-*/src/**/*.ts",
        "packages/oxfmt-config/src/**/*.ts",
        "packages/oxlint-config/src/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/test-support.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 93,
        branches: 87,
        functions: 96,
        lines: 95,
      },
    },
  },
});
