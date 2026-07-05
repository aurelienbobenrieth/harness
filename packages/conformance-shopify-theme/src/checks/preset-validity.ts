import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { parseSchema, schemaSettingIds } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema";

export const presetValidity: ConformanceCheck = {
  id: "preset-validity",
  description: "Schema presets only set settings that exist in the schema.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const directory of ["sections", "blocks"]) {
      for (const entry of await listDirectory(path.join(root, directory))) {
        if (!entry.endsWith(".liquid")) continue;
        const relativePath = `${directory}/${entry}`;
        const content = (await readTextFile(path.join(root, directory, entry))) ?? "";
        const schema = parseSchema(content);
        if (schema === undefined) continue;

        const ids = schemaSettingIds(schema);
        for (const preset of schema.presets ?? []) {
          for (const settingKey of Object.keys(preset.settings ?? {})) {
            if (ids.has(settingKey)) continue;
            findings.push({
              check: "preset-validity",
              severity: "error",
              message: `${relativePath}: preset "${preset.name ?? "?"}" sets unknown setting "${settingKey}".`,
              path: relativePath,
              docs,
            });
          }
        }
      }
    }

    return findings;
  },
};
