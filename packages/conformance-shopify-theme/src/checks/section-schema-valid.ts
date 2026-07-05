import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { hasSchemaTag, parseSchema, schemaSettingIds } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema";

async function checkDirectory(root: string, directory: string, findings: ConformanceFinding[]): Promise<void> {
  for (const entry of await listDirectory(path.join(root, directory))) {
    if (!entry.endsWith(".liquid")) continue;
    const relativePath = `${directory}/${entry}`;
    const content = (await readTextFile(path.join(root, directory, entry))) ?? "";
    if (!hasSchemaTag(content)) continue;

    const schema = parseSchema(content);
    if (schema === undefined) {
      findings.push({
        check: "section-schema-valid",
        severity: "error",
        message: `${relativePath} has a {% schema %} block that is not valid JSON.`,
        path: relativePath,
        docs,
      });
      continue;
    }

    const seen = new Set<string>();
    for (const setting of schema.settings ?? []) {
      if (typeof setting.id !== "string") continue;
      if (seen.has(setting.id)) {
        findings.push({
          check: "section-schema-valid",
          severity: "error",
          message: `${relativePath} declares the setting id "${setting.id}" more than once.`,
          path: relativePath,
          docs,
        });
      }
      seen.add(setting.id);
    }

    if (schema.settings !== undefined && schemaSettingIds(schema).size === 0 && schema.settings.length > 0) {
      findings.push({
        check: "section-schema-valid",
        severity: "error",
        message: `${relativePath} has settings without ids (only header/paragraph settings may omit ids).`,
        path: relativePath,
        docs,
      });
    }
  }
}

export const sectionSchemaValid: ConformanceCheck = {
  id: "section-schema-valid",
  description: "Every {% schema %} block in sections and blocks parses as JSON with unique setting ids.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];
    await checkDirectory(root, "sections", findings);
    await checkDirectory(root, "blocks", findings);
    return findings;
  },
};
