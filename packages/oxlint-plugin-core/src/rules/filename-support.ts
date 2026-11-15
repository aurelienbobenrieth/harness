export type RuleContextWithFilename = {
  readonly filename?: string;
  readonly getFilename?: () => string;
};

/** Returns the linted file path with forward slashes on every platform. */
export function getFilename(context: RuleContextWithFilename): string {
  return (context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/");
}

const testFilePattern = /\.(test|spec)(-d)?\.[cm]?[jt]sx?$/;

/** True for `*.test.*`, `*.spec.*`, and Vitest type-test `*.test-d.*` JavaScript or TypeScript files. */
export function isTestFile(context: RuleContextWithFilename): boolean {
  return testFilePattern.test(getFilename(context));
}

/**
 * True for files that may hold test-only code: tests, Vitest config and setup files, test helper files, and the
 * conventional test folders (`test-utils`, `testing`, `test`, `tests`, `__tests__`, `__mocks__`, `e2e`).
 */
export function isTestSupportFile(filename: string): boolean {
  return (
    /\.(?:test|spec|it-test)(?:-d)?\.[cm]?[tj]sx?$/u.test(filename) ||
    /(?:^|\/)vitest\.(?:config|setup|workspace)\.[cm]?[tj]s$/u.test(filename) ||
    /(?:^|\/)test-(?:setup|support|helpers?|utils?)\.[cm]?[tj]sx?$/u.test(filename) ||
    /(?:^|\/)(?:test-utils|testing|tests?|__tests__|__mocks__|e2e)\//u.test(filename)
  );
}
