import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/templates";

const defaultRequiredTemplates = [
  "404",
  "article",
  "blog",
  "cart",
  "collection",
  "gift_card",
  "index",
  "list-collections",
  "page",
  "password",
  "product",
  "search",
  "customers/account",
  "customers/activate_account",
  "customers/addresses",
  "customers/login",
  "customers/order",
  "customers/register",
  "customers/reset_password",
];

export const routeCoverage: ConformanceCheck = {
  id: "route-coverage",
  description: "Every Shopify route ships a template so no storefront URL renders a blank page.",
  docs,
  async run({ root, requiredTemplates }) {
    const findings: ConformanceFinding[] = [];
    const required = requiredTemplates ?? defaultRequiredTemplates;

    const rootEntries = await listDirectory(path.join(root, "templates"));
    const customerEntries = await listDirectory(path.join(root, "templates", "customers"));
    const present = new Set<string>();
    for (const entry of rootEntries) {
      present.add(entry.replace(/\.(json|liquid)$/, ""));
    }
    for (const entry of customerEntries) {
      present.add(`customers/${entry.replace(/\.(json|liquid)$/, "")}`);
    }

    for (const template of required) {
      if (present.has(template)) continue;
      findings.push({
        check: "route-coverage",
        severity: "error",
        message: `templates/${template}.json is missing: the route renders Shopify's bare fallback.`,
        docs,
      });
    }

    return findings;
  },
};
