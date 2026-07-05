import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isDirectory, listDirectory, readTextFile } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture";

export const requiredStructure: ConformanceCheck = {
  id: "required-structure",
  description: "Themes must ship layout/theme.liquid and keep the assets directory flat.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    if ((await readTextFile(path.join(root, "layout", "theme.liquid"))) === undefined) {
      findings.push({
        check: "required-structure",
        severity: "error",
        message: "layout/theme.liquid is missing: it is the only file Shopify requires in every theme.",
        path: path.join(root, "layout"),
        docs,
      });
    }

    const assetsRoot = path.join(root, "assets");
    for (const entry of await listDirectory(assetsRoot)) {
      if (entry.startsWith(".")) continue; // tooling metadata (e.g. .vite), excluded from upload
      if (await isDirectory(path.join(assetsRoot, entry))) {
        findings.push({
          check: "required-structure",
          severity: "error",
          message: `assets/${entry} is a directory: the assets directory must stay flat (subdirectories are not supported).`,
          path: path.join(assetsRoot, entry),
          docs,
        });
      }
    }

    return findings;
  },
};
