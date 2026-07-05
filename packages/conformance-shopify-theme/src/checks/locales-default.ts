import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/locales";

export const localesDefault: ConformanceCheck = {
  id: "locales-default",
  description: "Themes must ship exactly one default locale file and every locale file must parse as JSON.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];
    const localesRoot = path.join(root, "locales");
    const localeFiles = (await listDirectory(localesRoot)).filter(
      (entry) => entry.endsWith(".json") && !entry.endsWith(".schema.json"),
    );
    if (localeFiles.length === 0) return [];

    const storefrontLocaleFiles = localeFiles.filter((entry) => !entry.includes(".schema."));
    const defaultLocaleFiles = storefrontLocaleFiles.filter((entry) => entry.endsWith(".default.json"));
    if (defaultLocaleFiles.length !== 1) {
      findings.push({
        check: "locales-default",
        severity: "error",
        message: `Expected exactly one <lang>.default.json in locales/, found ${defaultLocaleFiles.length}.`,
        path: localesRoot,
        docs,
      });
    }

    for (const localeFile of localeFiles) {
      const content = (await readTextFile(path.join(localesRoot, localeFile))) ?? "";
      try {
        JSON.parse(content);
      } catch {
        findings.push({
          check: "locales-default",
          severity: "error",
          message: `locales/${localeFile} is not valid JSON.`,
          path: path.join(localesRoot, localeFile),
          docs,
        });
      }
    }

    return findings;
  },
};
