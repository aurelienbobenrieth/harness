import path from "node:path";
import { createRuleHarness } from "@aurelienbbn/oxlint-kit/testing";

/** Rule harness bound to this package's built plugin. */
export const { assertRuleReports, assertRuleDoesNotReport, fixCode } = createRuleHarness(
  path.resolve(import.meta.dirname, "..", ".."),
);
