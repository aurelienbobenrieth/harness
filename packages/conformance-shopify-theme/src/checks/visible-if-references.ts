import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { parseSchema, schemaSettingIds } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/settings/conditional-settings";
const referencePattern = /(?:block|section)\.settings\.([a-zA-Z_][\w]*)/g;

export const visibleIfReferences: ConformanceCheck = {
  id: "visible-if-references",
  description: "visible_if expressions only reference settings that exist in the same schema.",
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
        for (const setting of schema.settings ?? []) {
          if (typeof setting.visible_if !== "string") continue;
          for (const match of setting.visible_if.matchAll(referencePattern)) {
            const referenced = match[1];
            if (referenced === undefined || ids.has(referenced)) continue;
            findings.push({
              check: "visible-if-references",
              severity: "error",
              message: `${relativePath}: visible_if on "${setting.id ?? "?"}" references missing setting "${referenced}".`,
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
