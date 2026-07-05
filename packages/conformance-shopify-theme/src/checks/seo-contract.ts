import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/layouts";

export const seoContract: ConformanceCheck = {
  id: "seo-contract",
  description:
    "Themes must render canonical URLs and meta descriptions, and product themes should ship structured data and social meta tags.",
  docs,
  async run({ root }) {
    const layoutPath = path.join(root, "layout", "theme.liquid");
    const layoutContent = await readTextFile(layoutPath);
    if (layoutContent === undefined) return [];

    const findings: ConformanceFinding[] = [];
    const liquidFiles = await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 });
    let themeContent = "";
    for (const liquidFile of liquidFiles) {
      themeContent += (await readTextFile(liquidFile)) ?? "";
    }

    if (!themeContent.includes("canonical_url")) {
      findings.push({
        check: "seo-contract",
        severity: "error",
        message: 'The theme never renders <link rel="canonical" href="{{ canonical_url }}"> (layout or snippet).',
        path: layoutPath,
        docs,
      });
    }

    if (!/page_description|meta_description/.test(themeContent)) {
      findings.push({
        check: "seo-contract",
        severity: "error",
        message: "The theme never renders a meta description ({{ page_description }}).",
        path: layoutPath,
        docs,
      });
    }

    if (!/og:title|twitter:card|social-meta|social_meta/.test(themeContent)) {
      findings.push({
        check: "seo-contract",
        severity: "warning",
        message: "No Open Graph or Twitter card markup found: product shares will render without rich previews.",
        docs,
      });
    }

    const templateFiles = await listDirectory(path.join(root, "templates"));
    const hasProductTemplate = templateFiles.some((entry) => entry.startsWith("product."));
    if (hasProductTemplate && !themeContent.includes("application/ld+json")) {
      findings.push({
        check: "seo-contract",
        severity: "warning",
        message:
          "The theme has product templates but no JSON-LD structured data (application/ld+json): rich results need a Product schema.",
        docs,
      });
    }

    return findings;
  },
};
