import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { docText } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/tools/liquid-doc";
const paramPattern = /@param\s+(?:\{[^}]*\}\s+)?\[?([a-zA-Z_][\w]*)\]?/g;

export const liquiddocParams: ConformanceCheck = {
  id: "liquiddoc-params",
  description: "Documented snippet params are actually used by the snippet body.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const entry of await listDirectory(path.join(root, "snippets"))) {
      if (!entry.endsWith(".liquid")) continue;
      const content = (await readTextFile(path.join(root, "snippets", entry))) ?? "";
      const documentation = docText(content);
      if (documentation === undefined) continue;

      const body = content.replace(documentation, "");
      for (const match of documentation.matchAll(paramPattern)) {
        const parameter = match[1];
        if (parameter === undefined) continue;
        const usagePattern = new RegExp(`\\b${parameter}\\b`);
        if (usagePattern.test(body)) continue;
        findings.push({
          check: "liquiddoc-params",
          severity: "error",
          message: `snippets/${entry} documents @param "${parameter}" but never uses it.`,
          path: `snippets/${entry}`,
          docs,
        });
      }
    }

    return findings;
  },
};
