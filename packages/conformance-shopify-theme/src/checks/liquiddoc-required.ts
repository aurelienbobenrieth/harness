import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { hasDocTag, hasSchemaTag } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/tools/liquid-doc";

export const liquiddocRequired: ConformanceCheck = {
  id: "liquiddoc-required",
  description: "Every snippet and schema-less block documents its contract with a {% doc %} header.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const entry of await listDirectory(path.join(root, "snippets"))) {
      if (!entry.endsWith(".liquid")) continue;
      const content = (await readTextFile(path.join(root, "snippets", entry))) ?? "";
      if (hasDocTag(content)) continue;
      if (/auto[- ]?generated|automatically generated/i.test(content.slice(0, 300))) continue; // build tool output
      findings.push({
        check: "liquiddoc-required",
        severity: "error",
        message: `snippets/${entry} is missing a {% doc %} header documenting its parameters.`,
        path: `snippets/${entry}`,
        docs,
      });
    }

    for (const entry of await listDirectory(path.join(root, "blocks"))) {
      if (!entry.endsWith(".liquid")) continue;
      const content = (await readTextFile(path.join(root, "blocks", entry))) ?? "";
      if (hasSchemaTag(content) || hasDocTag(content)) continue;
      findings.push({
        check: "liquiddoc-required",
        severity: "error",
        message: `blocks/${entry} has no schema and no {% doc %} header: internal blocks must document their contract.`,
        path: `blocks/${entry}`,
        docs,
      });
    }

    return findings;
  },
};
