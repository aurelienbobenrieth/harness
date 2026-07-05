import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://github.com/aurelienbbn/harness#conformance-shopify-theme";
const customClassesPattern = /"custom_classes"\s*:\s*"([^"]*)"/g;

export const utilityGrammar: ConformanceCheck = {
  id: "utility-grammar",
  description: "Free-form custom_classes values only use classes from the safelisted utility grammar.",
  docs,
  async run({ root, utilityClasses }) {
    const findings: ConformanceFinding[] = [];
    if (utilityClasses === undefined || utilityClasses.length === 0) return findings;

    const allowed = new Set(utilityClasses);

    const candidates = await walkFiles(root, { extensions: [".json", ".liquid"], maxDepth: 4 });
    for (const file of candidates) {
      const relativePath = path.relative(root, file).replaceAll(path.sep, "/");
      if (
        !relativePath.startsWith("templates/") &&
        !relativePath.startsWith("sections/") &&
        !relativePath.startsWith("blocks/") &&
        !relativePath.startsWith("config/")
      ) {
        continue;
      }
      const content = (await readTextFile(file)) ?? "";
      for (const match of content.matchAll(customClassesPattern)) {
        for (const className of (match[1] ?? "").split(/\s+/).filter((entry) => entry.length > 0)) {
          if (allowed.has(className)) continue;
          findings.push({
            check: "utility-grammar",
            severity: "error",
            message: `${relativePath}: custom_classes uses "${className}" which is not in the utility safelist.`,
            path: relativePath,
            docs,
          });
        }
      }
    }

    return findings;
  },
};
