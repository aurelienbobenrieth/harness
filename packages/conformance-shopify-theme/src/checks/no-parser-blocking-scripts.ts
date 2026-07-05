import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/best-practices/performance";
const scriptTagPattern = /<script\b[^>]*\bsrc=[^>]*>/gi;
const nonBlockingPattern = /\bdefer\b|\basync\b|type=["']module["']/i;

export const noParserBlockingScripts: ConformanceCheck = {
  id: "no-parser-blocking-scripts",
  description: "External scripts in Liquid files must load with defer, async, or type=module.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];
    const liquidFiles = await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 });

    for (const liquidFile of liquidFiles) {
      const content = (await readTextFile(liquidFile)) ?? "";
      for (const match of content.matchAll(scriptTagPattern)) {
        if (nonBlockingPattern.test(match[0])) continue;
        findings.push({
          check: "no-parser-blocking-scripts",
          severity: "error",
          message: `${path.relative(root, liquidFile)} loads a parser-blocking script: add defer, async, or type="module".`,
          path: liquidFile,
          docs,
        });
      }
    }

    return findings;
  },
};
