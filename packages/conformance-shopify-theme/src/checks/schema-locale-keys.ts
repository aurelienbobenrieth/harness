import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { collectTranslationKeys, localeKeyExists, parseJson, parseSchema } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/locales/schema-locale-files";

async function defaultSchemaLocale(root: string): Promise<{ path: string; data: unknown } | undefined> {
  for (const entry of await listDirectory(path.join(root, "locales"))) {
    if (!entry.endsWith(".default.schema.json")) continue;
    const content = await readTextFile(path.join(root, "locales", entry));
    if (content === undefined) return undefined;
    return { path: `locales/${entry}`, data: parseJson(content) };
  }
  return undefined;
}

export const schemaLocaleKeys: ConformanceCheck = {
  id: "schema-locale-keys",
  description: "Every t: key referenced in schemas exists in the default schema locale file.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];
    const locale = await defaultSchemaLocale(root);
    if (locale === undefined || locale.data === undefined) {
      findings.push({
        check: "schema-locale-keys",
        severity: "error",
        message: "No parseable locales/*.default.schema.json found: schema labels cannot be translated.",
        docs,
      });
      return findings;
    }

    const keysByFile = new Map<string, Set<string>>();

    for (const directory of ["sections", "blocks"]) {
      for (const entry of await listDirectory(path.join(root, directory))) {
        if (!entry.endsWith(".liquid")) continue;
        const content = (await readTextFile(path.join(root, directory, entry))) ?? "";
        const schema = parseSchema(content);
        if (schema === undefined) continue;
        const keys = new Set<string>();
        collectTranslationKeys(schema, keys);
        keysByFile.set(`${directory}/${entry}`, keys);
      }
    }

    const settingsSchemaContent = await readTextFile(path.join(root, "config", "settings_schema.json"));
    if (settingsSchemaContent !== undefined) {
      const keys = new Set<string>();
      collectTranslationKeys(parseJson(settingsSchemaContent), keys);
      keysByFile.set("config/settings_schema.json", keys);
    }

    for (const [file, keys] of keysByFile) {
      for (const key of keys) {
        if (localeKeyExists(locale.data, key)) continue;
        findings.push({
          check: "schema-locale-keys",
          severity: "error",
          message: `${file} references "t:${key}" which is missing from ${locale.path}.`,
          path: file,
          docs,
        });
      }
    }

    return findings;
  },
};
