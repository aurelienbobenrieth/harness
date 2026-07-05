import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile, walkFiles } from "../fs-support.js";
import {
  collectTranslationKeys,
  flattenLocaleKeys,
  localeKeyExists,
  parseJson,
  parseSchema,
} from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/locales/storefront-locale-files";
const tFilterPattern = /["']([\w.-]+)["']\s*\|\s*t[\s:|}]/g;

async function localeData(root: string, suffix: string): Promise<{ path: string; data: unknown } | undefined> {
  for (const entry of await listDirectory(path.join(root, "locales"))) {
    if (!entry.endsWith(suffix)) continue;
    const content = await readTextFile(path.join(root, "locales", entry));
    if (content === undefined) continue;
    return { path: `locales/${entry}`, data: parseJson(content) };
  }
  return undefined;
}

export const orphanLocaleKeys: ConformanceCheck = {
  id: "orphan-locale-keys",
  description: "Locale keys and usages stay in sync in both directions.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    const storefrontLocale = await localeData(root, ".default.json");
    if (storefrontLocale?.data !== undefined) {
      const usedKeys = new Set<string>();
      for (const liquidFile of await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 })) {
        const content = (await readTextFile(liquidFile)) ?? "";
        for (const match of content.matchAll(tFilterPattern)) {
          if (match[1] !== undefined) usedKeys.add(match[1]);
        }
      }

      for (const key of usedKeys) {
        if (localeKeyExists(storefrontLocale.data, key)) continue;
        findings.push({
          check: "orphan-locale-keys",
          severity: "error",
          message: `"${key}" is used with the t filter but missing from ${storefrontLocale.path}.`,
          docs,
        });
      }

      for (const key of flattenLocaleKeys(storefrontLocale.data)) {
        if (key.startsWith("shopify.")) continue;
        const prefix = key.split(".")[0] ?? key;
        const isUsed = usedKeys.has(key) || [...usedKeys].some((used) => used === key || used.startsWith(`${key}.`));
        if (isUsed || prefix === "general") continue;
        findings.push({
          check: "orphan-locale-keys",
          severity: "warning",
          message: `${storefrontLocale.path} declares "${key}" which no Liquid file uses.`,
          path: storefrontLocale.path,
          docs,
        });
      }
    }

    const schemaLocale = await localeData(root, ".default.schema.json");
    if (schemaLocale?.data !== undefined) {
      const usedSchemaKeys = new Set<string>();
      for (const directory of ["sections", "blocks"]) {
        for (const entry of await listDirectory(path.join(root, directory))) {
          if (!entry.endsWith(".liquid")) continue;
          const content = (await readTextFile(path.join(root, directory, entry))) ?? "";
          const schema = parseSchema(content);
          if (schema !== undefined) collectTranslationKeys(schema, usedSchemaKeys);
        }
      }
      const settingsSchemaContent = await readTextFile(path.join(root, "config", "settings_schema.json"));
      if (settingsSchemaContent !== undefined) {
        collectTranslationKeys(parseJson(settingsSchemaContent), usedSchemaKeys);
      }

      for (const key of flattenLocaleKeys(schemaLocale.data)) {
        if (usedSchemaKeys.has(key)) continue;
        findings.push({
          check: "orphan-locale-keys",
          severity: "warning",
          message: `${schemaLocale.path} declares "${key}" which no schema references.`,
          path: schemaLocale.path,
          docs,
        });
      }
    }

    return findings;
  },
};
