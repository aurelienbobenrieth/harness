import path from "node:path";
import { readExtensionManifests } from "../extension-manifests.js";
import type { ConformanceCheck } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { hasTranslation, parseLocale } from "../locale-support.js";

const docs = "https://shopify.dev/docs/apps/build/functions/localization-practices-shopify-functions";

/**
 * @attribution https://shopify.dev/docs/apps/build/functions/localization-practices-shopify-functions (inspiration; independently implemented)
 * @attribution https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/app/loader.ts (MIT concept; independently implemented)
 */
export const functionsLocalization: ConformanceCheck = {
  id: "functions-localization",
  description: "Function extensions using t: translation keys must ship a complete locales/ contract.",
  docs,
  async run(options) {
    const { manifests, findings } = await readExtensionManifests(options, "functions-localization", docs);
    for (const manifest of manifests) {
      const extensionRoot = path.dirname(manifest.path);
      const extensionName = path.basename(extensionRoot);
      const translationKeys = [
        ...new Set(
          manifest.extensions
            .filter((entry) => entry.type === "function")
            .flatMap((entry) => [
              entry.name,
              Object.hasOwn(entry, "description") ? entry.description : manifest.config.description,
            ])
            .filter((value): value is string => typeof value === "string" && value.startsWith("t:"))
            .map((value) => value.slice(2)),
        ),
      ];
      if (translationKeys.length === 0) continue;

      const localesRoot = path.join(extensionRoot, "locales");
      const localeFiles = (await listDirectory(localesRoot)).filter((entry) => entry.endsWith(".json"));
      const defaultLocaleFiles = localeFiles.filter((entry) => entry.endsWith(".default.json"));

      if (defaultLocaleFiles.length !== 1) {
        findings.push({
          check: "functions-localization",
          severity: "error",
          message: `Extension "${extensionName}" uses t: translation keys but has ${defaultLocaleFiles.length} default locale files in locales/ (exactly one <lang>.default.json is required).`,
          path: localesRoot,
          docs,
        });
        continue;
      }

      for (const localeFile of localeFiles) {
        const localeContent = (await readTextFile(path.join(localesRoot, localeFile))) ?? "";
        const locale = parseLocale(localeContent);
        if (locale === undefined) {
          findings.push({
            check: "functions-localization",
            severity: "error",
            message: `Extension "${extensionName}" locale file ${localeFile} is not a valid JSON object.`,
            path: path.join(localesRoot, localeFile),
            docs,
          });
          continue;
        }

        const isDefaultLocale = localeFile.endsWith(".default.json");
        for (const translationKey of translationKeys) {
          if (hasTranslation(locale, translationKey)) continue;
          findings.push({
            check: "functions-localization",
            severity: isDefaultLocale ? "error" : "warning",
            message: `Extension "${extensionName}" locale file ${localeFile} is missing the "${translationKey}" key referenced from ${path.basename(manifest.path)}.`,
            path: path.join(localesRoot, localeFile),
            docs,
          });
        }
      }
    }

    return findings;
  },
};
