import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/best-practices/performance/platform#images";
const imageUrlPattern = /\|\s*image_url(?::\s*)?(\([^)]*\)|[^|}]*)/g;
const rawImgPattern = /<img\b[^>]*>/gi;

export const imagePolicy: ConformanceCheck = {
  id: "image-policy",
  description: "Images request explicit widths from the CDN and declare a loading strategy.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const liquidFile of await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 })) {
      const relativePath = path.relative(root, liquidFile).replaceAll(path.sep, "/");
      const content = (await readTextFile(liquidFile)) ?? "";

      for (const match of content.matchAll(imageUrlPattern)) {
        const args = match[1] ?? "";
        if (/\bwidth\s*:/.test(args)) continue;
        findings.push({
          check: "image-policy",
          severity: "error",
          message: `${relativePath} calls image_url without width: the CDN serves the original, unsized asset.`,
          path: relativePath,
          docs,
        });
      }

      for (const match of content.matchAll(rawImgPattern)) {
        const tag = match[0];
        if (/loading\s*=/.test(tag) || /{{/.test(tag)) continue;
        findings.push({
          check: "image-policy",
          severity: "error",
          message: `${relativePath} has a raw <img> without a loading attribute (lazy/eager must be deliberate).`,
          path: relativePath,
          docs,
        });
      }
    }

    return findings;
  },
};
