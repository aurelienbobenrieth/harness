import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { changeScatterReview, defineChangeScatterReview } from "./rule.js";

it("reports a new decision token spread across three production files", async () => {
  const findings = await testRuleOnChange({
    rule: changeScatterReview,
    fixture: {
      before: { "src/a.ts": "", "src/b.ts": "", "src/c.ts": "" },
      after: {
        "src/a.ts": "if (state === 'awaiting-payment') run();\n",
        "src/b.ts": "case 'awaiting-payment': run();\n",
        "src/c.ts": "return { status: 'awaiting-payment' };\n",
      },
    },
  });
  expect(findings.map((finding) => [finding.file, finding.line, finding.authority, finding.lineageKey])).toEqual([
    ["src/a.ts", 1, "human", "awaiting-payment"],
  ]);
});

it("stays silent below the file threshold and for imports, tests and generated output", async () => {
  const findings = await testRuleOnChange({
    rule: changeScatterReview,
    fixture: {
      before: {},
      after: {
        "src/a.ts": "return 'awaiting-payment';\n",
        "src/b.test.ts": "expect(value).toBe('awaiting-payment');\n",
        "generated/c.ts": "export const state = 'awaiting-payment';\n",
        "src/d.ts": "import value from 'awaiting-payment';\n",
      },
    },
  });
  expect(findings).toEqual([]);
});

it("supports a repository token pattern and calibrated threshold", async () => {
  const rule = defineChangeScatterReview({ minFiles: 2, tokenPattern: /STATE_([A-Z_]+)/g });
  const findings = await testRuleOnChange({
    rule,
    fixture: {
      before: {},
      after: { "src/a.ts": "const a = STATE_READY;\n", "src/b.ts": "const b = STATE_READY;\n" },
    },
  });
  expect(findings.map((finding) => finding.lineageKey)).toEqual(["READY"]);
  expect(() => defineChangeScatterReview({ maxFindings: 0 })).toThrow("must be positive");
});
