import path from "node:path";
import { createRuleHarness } from "@aurelienbbn/oxlint-kit/testing";

/** Rule harness bound to this package's built plugin. */
export const { assertRuleReports, assertRuleDoesNotReport, lintCode, fixCode, reportedMessages } = createRuleHarness(
  path.resolve(import.meta.dirname, "..", ".."),
);

export function assertRuleReportsInEffect(
  name: string,
  code: string,
  options?: Parameters<typeof assertRuleReports>[2],
) {
  const imports = code.split("\n").filter((line) => line.startsWith("import "));
  const body = code
    .split("\n")
    .filter((line) => !line.startsWith("import "))
    .join("\n")
    .replaceAll("export ", "");

  return assertRuleReports(
    name,
    [...imports, 'import { Effect as Runtime } from "effect";', `Runtime.gen(function* () { ${body} });`].join("\n"),
    options,
  );
}
