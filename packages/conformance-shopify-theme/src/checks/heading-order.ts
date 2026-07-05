import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";

const docs = "https://www.w3.org/WAI/tutorials/page-structure/headings/";
const h1Pattern = /<h1[\s>]/i;

/** Sections that own a route's primary heading may render an h1. */
const defaultH1Sections = new Set([
  "home",
  "product",
  "collection",
  "article",
  "blog",
  "page",
  "search",
  "password",
  "404",
  "cart",
  "list-collections",
]);

export const headingOrder: ConformanceCheck = {
  id: "heading-order",
  description: "Only route-owning sections hardcode an h1; blocks and snippets keep heading levels configurable.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];

    for (const directory of ["blocks", "snippets"]) {
      for (const entry of await listDirectory(path.join(root, directory))) {
        if (!entry.endsWith(".liquid")) continue;
        const content = (await readTextFile(path.join(root, directory, entry))) ?? "";
        if (!h1Pattern.test(content)) continue;
        findings.push({
          check: "heading-order",
          severity: "error",
          message: `${directory}/${entry} hardcodes an <h1>: blocks/snippets must expose configurable heading levels.`,
          path: `${directory}/${entry}`,
          docs,
        });
      }
    }

    for (const entry of await listDirectory(path.join(root, "sections"))) {
      if (!entry.endsWith(".liquid")) continue;
      const sectionName = entry.replace(/\.liquid$/, "");
      if (defaultH1Sections.has(sectionName)) continue;
      const content = (await readTextFile(path.join(root, "sections", entry))) ?? "";
      if (!h1Pattern.test(content)) continue;
      findings.push({
        check: "heading-order",
        severity: "warning",
        message: `sections/${entry} hardcodes an <h1> but is not a route-owning section: verify the page outline.`,
        path: `sections/${entry}`,
        docs,
      });
    }

    return findings;
  },
};
