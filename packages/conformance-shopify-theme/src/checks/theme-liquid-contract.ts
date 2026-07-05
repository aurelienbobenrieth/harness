import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/layouts";
const zoomBlockPattern = /maximum-scale|user-scalable\s*=\s*no/i;

export const themeLiquidContract: ConformanceCheck = {
  id: "theme-liquid-contract",
  description:
    "layout/theme.liquid must render content_for_header and content_for_layout, set html lang, and allow zoom.",
  docs,
  async run({ root }) {
    const layoutPath = path.join(root, "layout", "theme.liquid");
    const content = await readTextFile(layoutPath);
    if (content === undefined) return [];

    const findings: ConformanceFinding[] = [];
    const requirements: readonly { readonly present: boolean; readonly message: string }[] = [
      {
        present: content.includes("content_for_header"),
        message: "layout/theme.liquid must output {{ content_for_header }} inside <head> (Shopify requirement).",
      },
      {
        present: content.includes("content_for_layout"),
        message: "layout/theme.liquid must output {{ content_for_layout }} inside <body> (Shopify requirement).",
      },
      {
        present: /<html[^>]*\slang=/i.test(content),
        message: "The html element must set a lang attribute for assistive technology.",
      },
      {
        present: /<meta[^>]*name=["']viewport["']/i.test(content),
        message: "A viewport meta tag is required for responsive rendering on mobile.",
      },
    ];

    for (const requirement of requirements) {
      if (requirement.present) continue;
      findings.push({
        check: "theme-liquid-contract",
        severity: "error",
        message: requirement.message,
        path: layoutPath,
        docs,
      });
    }

    const viewportMatch = content.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
    if (viewportMatch !== null && zoomBlockPattern.test(viewportMatch[0])) {
      findings.push({
        check: "theme-liquid-contract",
        severity: "error",
        message: "The viewport meta tag must not block zoom: remove maximum-scale and user-scalable=no.",
        path: layoutPath,
        docs,
      });
    }

    return findings;
  },
};
