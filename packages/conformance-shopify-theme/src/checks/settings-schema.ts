import path from "node:path";
import type { ConformanceCheck } from "../finding.js";
import { readTextFile } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/config/settings-schema-json";

export const settingsSchema: ConformanceCheck = {
  id: "settings-schema",
  description: "config/settings_schema.json must parse as an array and declare theme_info.",
  docs,
  async run({ root }) {
    const schemaPath = path.join(root, "config", "settings_schema.json");
    const content = await readTextFile(schemaPath);
    if (content === undefined) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return [
        {
          check: "settings-schema",
          severity: "error",
          message: "config/settings_schema.json is not valid JSON.",
          path: schemaPath,
          docs,
        },
      ];
    }

    if (!Array.isArray(parsed)) {
      return [
        {
          check: "settings-schema",
          severity: "error",
          message: "config/settings_schema.json must be an array of setting categories.",
          path: schemaPath,
          docs,
        },
      ];
    }

    const hasThemeInfo = parsed.some(
      (item) => typeof item === "object" && item !== null && (item as { name?: unknown }).name === "theme_info",
    );
    if (hasThemeInfo) return [];

    return [
      {
        check: "settings-schema",
        severity: "error",
        message:
          'config/settings_schema.json must include a "theme_info" entry with theme name, version, and support links.',
        path: schemaPath,
        docs,
      },
    ];
  },
};
