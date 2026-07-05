import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://web.dev/articles/optimize-cls";
const imageTagStatementPattern = /{{-?[^}]*\|\s*image_tag[^}]*-?}}/g;
const rawImgPattern = /<img\b[^>]*>/gi;

function hasDimensions(statement: string): boolean {
  const hasWidth = /\bwidth\s*:/.test(statement) || /\bwidth\s*=/.test(statement);
  const hasHeight = /\bheight\s*:/.test(statement) || /\bheight\s*=/.test(statement);
  // image_url width + image_tag derives height from the aspect ratio automatically.
  const hasImageUrlWidth = /image_url[^|]*\bwidth\s*:/.test(statement);
  return (hasWidth && hasHeight) || hasImageUrlWidth;
}

export const imageDimensions: ConformanceCheck = {
  id: "image-dimensions",
  description: "Every rendered image reserves layout space via width/height so CLS stays at zero.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const liquidFile of await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 })) {
      const relativePath = path.relative(root, liquidFile).replaceAll(path.sep, "/");
      const content = (await readTextFile(liquidFile)) ?? "";

      for (const match of content.matchAll(imageTagStatementPattern)) {
        if (hasDimensions(match[0])) continue;
        findings.push({
          check: "image-dimensions",
          severity: "error",
          message: `${relativePath} renders an image_tag without width/height (or image_url width): reserves no layout space.`,
          path: relativePath,
          docs,
        });
      }

      for (const match of content.matchAll(rawImgPattern)) {
        const tag = match[0];
        if (/\bwidth\s*=/.test(tag) && /\bheight\s*=/.test(tag)) continue;
        if (/{{/.test(tag)) continue; // liquid-generated attributes are covered by the image_tag pass
        findings.push({
          check: "image-dimensions",
          severity: "error",
          message: `${relativePath} has a raw <img> without width and height attributes.`,
          path: relativePath,
          docs,
        });
      }
    }

    return findings;
  },
};
