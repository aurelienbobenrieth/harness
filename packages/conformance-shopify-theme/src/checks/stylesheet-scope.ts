import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/sections/section-assets";
const stylesheetPattern = /{%-?\s*stylesheet\s*-?%}([\s\S]*?){%-?\s*endstylesheet\s*-?%}/g;
const selectorPattern = /(^|})\s*([^@{}]+?)\s*{/g;

function isScopedSelectorList(selectorList: string): boolean {
  return selectorList
    .split(",")
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0)
    .every((selector) => selector.startsWith(".") || selector.startsWith("["));
}

export const stylesheetScope: ConformanceCheck = {
  id: "stylesheet-scope",
  description: "{% stylesheet %} selectors stay scoped to component classes, never bare elements or :root.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const liquidFile of await walkFiles(root, { extensions: [".liquid"], maxDepth: 4 })) {
      const relativePath = path.relative(root, liquidFile).replaceAll(path.sep, "/");
      const content = (await readTextFile(liquidFile)) ?? "";

      for (const stylesheetMatch of content.matchAll(stylesheetPattern)) {
        const css = stylesheetMatch[1] ?? "";
        for (const selectorMatch of css.matchAll(selectorPattern)) {
          const selectorList = selectorMatch[2]?.trim() ?? "";
          if (selectorList.length === 0) continue;
          if (isScopedSelectorList(selectorList)) continue;
          findings.push({
            check: "stylesheet-scope",
            severity: "error",
            message: `${relativePath}: {% stylesheet %} selector "${selectorList}" is not scoped to a component class.`,
            path: relativePath,
            docs,
          });
        }
      }
    }

    return findings;
  },
};
