import assert from "node:assert/strict";
import stylelint, { type Plugin } from "stylelint";

type LintOptions = {
  readonly ruleOptions?: unknown;
};

async function lintCss(
  plugin: ReturnType<typeof stylelint.createPlugin> | Plugin,
  ruleName: string,
  css: string,
  options: LintOptions = {},
): Promise<readonly string[]> {
  const ruleConfig = options.ruleOptions === undefined ? true : [true, options.ruleOptions];
  const result = await stylelint.lint({
    code: css,
    config: {
      plugins: [plugin],
      rules: { [ruleName]: ruleConfig },
    },
  });
  const [fileResult] = result.results;
  assert.ok(fileResult, "expected a lint result");
  assert.equal(fileResult.invalidOptionWarnings.length, 0, JSON.stringify(fileResult.invalidOptionWarnings));
  return fileResult.warnings.filter((warning) => warning.rule === ruleName).map((warning) => warning.text);
}

export async function assertRuleReports(
  plugin: ReturnType<typeof stylelint.createPlugin> | Plugin,
  ruleName: string,
  css: string,
  options?: LintOptions,
): Promise<void> {
  const warnings = await lintCss(plugin, ruleName, css, options);
  assert.ok(warnings.length > 0, `expected ${ruleName} to report for:\n${css}`);
}

export async function assertRuleDoesNotReport(
  plugin: ReturnType<typeof stylelint.createPlugin> | Plugin,
  ruleName: string,
  css: string,
  options?: LintOptions,
): Promise<void> {
  const warnings = await lintCss(plugin, ruleName, css, options);
  assert.equal(warnings.length, 0, `expected no ${ruleName} reports, got:\n${warnings.join("\n")}`);
}
