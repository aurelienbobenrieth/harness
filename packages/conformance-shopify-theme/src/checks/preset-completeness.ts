import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { parseSchema } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema#presets";

export const presetCompleteness: ConformanceCheck = {
  id: "preset-completeness",
  description: "Every block with a schema ships at least one named preset so merchants can add it.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const entry of await listDirectory(path.join(root, "blocks"))) {
      if (!entry.endsWith(".liquid")) continue;
      const relativePath = `blocks/${entry}`;
      const content = (await readTextFile(path.join(root, "blocks", entry))) ?? "";
      const schema = parseSchema(content);
      if (schema === undefined) continue;

      const presets = schema.presets ?? [];
      if (presets.length === 0) {
        findings.push({
          check: "preset-completeness",
          severity: "error",
          message: `${relativePath} has a schema but no presets: merchants cannot add it from the editor.`,
          path: relativePath,
          docs,
        });
        continue;
      }
      if (presets.some((preset) => typeof preset.name !== "string" || preset.name.length === 0)) {
        findings.push({
          check: "preset-completeness",
          severity: "error",
          message: `${relativePath} has a preset without a name.`,
          path: relativePath,
          docs,
        });
      }
    }

    return findings;
  },
};
