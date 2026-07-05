import path from "node:path";
import type { AssetBudget, ConformanceCheck, ConformanceFinding } from "../finding.js";
import { fileSize, listDirectory } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/best-practices/performance";

const defaultBudgets: readonly AssetBudget[] = [
  { pattern: "*.js", maxBytes: 32_000 },
  { pattern: "*.css", maxBytes: 200_000 },
  { pattern: "critical*.css", maxBytes: 14_000 },
];

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[\\w.-]*");
  return new RegExp(`^${escaped}$`);
}

export const assetBudget: ConformanceCheck = {
  id: "asset-budget",
  description: "Static assets stay under their size budgets so feature islands ship lean.",
  docs,
  async run({ root, assetBudgets }) {
    const findings: ConformanceFinding[] = [];
    const budgets = (assetBudgets ?? defaultBudgets).map((budget) => ({
      ...budget,
      regexp: patternToRegExp(budget.pattern),
    }));

    for (const entry of await listDirectory(path.join(root, "assets"))) {
      // most specific matching budget wins (longest pattern)
      const matching = budgets
        .filter((budget) => budget.regexp.test(entry))
        .toSorted((a, b) => b.pattern.length - a.pattern.length)[0];
      if (matching === undefined) continue;
      const size = await fileSize(path.join(root, "assets", entry));
      if (size <= matching.maxBytes) continue;
      findings.push({
        check: "asset-budget",
        severity: "error",
        message: `assets/${entry} is ${size} bytes, over the ${matching.maxBytes} byte budget (${matching.pattern}).`,
        path: `assets/${entry}`,
        docs,
      });
    }

    return findings;
  },
};
