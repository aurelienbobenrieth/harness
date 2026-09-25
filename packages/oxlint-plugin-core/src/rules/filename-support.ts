export type RuleContextWithFilename = {
  readonly filename?: string;
  readonly getFilename?: () => string;
};

/** Returns the linted file path with forward slashes on every platform. */
export function getFilename(context: RuleContextWithFilename): string {
  return (context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/");
}

const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** True for `*.test.*` and `*.spec.*` JavaScript or TypeScript files. */
export function isTestFile(context: RuleContextWithFilename): boolean {
  return testFilePattern.test(getFilename(context));
}

/** True for files that may hold test-only code: tests, Vitest config and setup files, and test utility folders. */
export function isTestSupportFile(filename: string): boolean {
  return (
    /\.(?:test|spec|it-test)\.[cm]?[tj]sx?$/u.test(filename) ||
    /(?:^|\/)vitest\.(?:config|setup)\.[cm]?[tj]s$/u.test(filename) ||
    filename.includes("/test-utils/") ||
    filename.includes("/testing/")
  );
}
