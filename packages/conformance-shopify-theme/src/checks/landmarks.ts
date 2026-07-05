import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";

const docs = "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/";
const mainPattern = /<main[\s>]|role=["']main["']/gi;

export const landmarks: ConformanceCheck = {
  id: "landmarks",
  description: "The layout owns exactly one main landmark; sections never add another.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    const layout = (await readTextFile(path.join(root, "layout", "theme.liquid"))) ?? "";
    const layoutMains = [...layout.matchAll(mainPattern)].length;
    if (layoutMains !== 1) {
      findings.push({
        check: "landmarks",
        severity: "error",
        message: `layout/theme.liquid declares ${layoutMains} main landmarks: exactly one is required.`,
        path: "layout/theme.liquid",
        docs,
      });
    }

    for (const directory of ["sections", "blocks", "snippets"]) {
      for (const entry of await listDirectory(path.join(root, directory))) {
        if (!entry.endsWith(".liquid")) continue;
        const content = (await readTextFile(path.join(root, directory, entry))) ?? "";
        if (!mainPattern.test(content)) continue;
        mainPattern.lastIndex = 0;
        findings.push({
          check: "landmarks",
          severity: "error",
          message: `${directory}/${entry} declares a main landmark: only layout/theme.liquid may own it.`,
          path: `${directory}/${entry}`,
          docs,
        });
      }
    }

    return findings;
  },
};
