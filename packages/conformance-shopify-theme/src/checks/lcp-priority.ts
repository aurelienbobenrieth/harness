import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://web.dev/articles/optimize-lcp";
const imageStatementPattern = /{{-?[^}]*\|\s*image_tag[^}]*-?}}|<img\b[^>]*>/gi;
const eagerPattern = /loading\s*[:=]\s*["']?eager/;
const fetchpriorityHighPattern = /fetchpriority\s*[:=]\s*["']?high/;

export const lcpPriority: ConformanceCheck = {
  id: "lcp-priority",
  description: "Eagerly loaded media also sets fetchpriority: high so the LCP element wins bandwidth.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const liquidFile of await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 })) {
      const relativePath = path.relative(root, liquidFile).replaceAll(path.sep, "/");
      const content = (await readTextFile(liquidFile)) ?? "";

      for (const match of content.matchAll(imageStatementPattern)) {
        const statement = match[0];
        if (!eagerPattern.test(statement)) continue;
        if (fetchpriorityHighPattern.test(statement)) continue;
        findings.push({
          check: "lcp-priority",
          severity: "error",
          message: `${relativePath} loads media eagerly without fetchpriority: 'high': the LCP candidate competes for bandwidth.`,
          path: relativePath,
          docs,
        });
      }
    }

    return findings;
  },
};
