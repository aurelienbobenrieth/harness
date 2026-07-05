import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/seo";

const requiredHeadMarkers: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  { id: "canonical", pattern: /rel=["']canonical["']|canonical_url/ },
  { id: "meta description", pattern: /name=["']description["']/ },
  { id: "og:title", pattern: /property=["']og:title["']/ },
  { id: "og:description", pattern: /property=["']og:description["']/ },
  { id: "og:image", pattern: /property=["']og:image["']/ },
  { id: "og:url", pattern: /property=["']og:url["']/ },
  { id: "twitter:card", pattern: /name=["']twitter:card["']/ },
];

export const metaCompleteness: ConformanceCheck = {
  id: "meta-completeness",
  description: "The head renders the complete SEO meta contract: canonical, description, Open Graph, Twitter.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    let combined = "";
    for (const liquidFile of await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 })) {
      const relativePath = path.relative(root, liquidFile).replaceAll(path.sep, "/");
      if (!relativePath.startsWith("layout/") && !relativePath.startsWith("snippets/")) continue;
      combined += (await readTextFile(liquidFile)) ?? "";
    }

    for (const marker of requiredHeadMarkers) {
      if (marker.pattern.test(combined)) continue;
      findings.push({
        check: "meta-completeness",
        severity: "error",
        message: `No layout or snippet renders ${marker.id}: the SEO meta contract is incomplete.`,
        docs,
      });
    }

    return findings;
  },
};
