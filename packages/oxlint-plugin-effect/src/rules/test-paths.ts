import type { Context } from "@oxlint/plugins";
import { optionsObject } from "@aurelienbbn/oxlint-kit/ast";
import { getFilename, isAllowedFile, type RuleContextWithOptions } from "./runtime-support.js";
import { stringArrayOption } from "./sota-support.js";

/**
 * Files where a failure is a bug in the test or the tool, not a recoverable domain outcome: test files, test-support
 * folders and modules (`testing/`, `testing.ts`, `fixtures/`), type tests, benchmarks, and scripts.
 */
export const testSupportFiles: readonly string[] = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.bench.*",
  "**/*.tst.*",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/testing/**",
  "**/testing.*",
  "**/fixtures/**",
  "**/__fixtures__/**",
  "**/e2e/**",
  "**/typetest/**",
  "**/dtslint/**",
  "**/benchmark/**",
  "**/scripts/**",
];

/** Schema fragment of the `allow` option that replaces {@link testSupportFiles} for a rule. */
export const allowOptionSchema = {
  type: "object",
  properties: { allow: { type: "array", items: { type: "string" } } },
  additionalProperties: false,
} as const;

/** Default options for a rule that skips {@link testSupportFiles} unless `allow` says otherwise. */
export const allowOptionDefaults = [{ allow: [...testSupportFiles] }];

/** Whether the current file is exempt: it matches the rule's `allow` option, by default {@link testSupportFiles}. */
export function isExemptFile(context: Context): boolean {
  const allow = stringArrayOption(optionsObject(context), "allow", testSupportFiles);
  return isAllowedFile(getFilename(context as RuleContextWithOptions), allow);
}
