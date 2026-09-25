import path from "node:path";
import type { ConformanceCheck } from "../finding.js";
import { fileSize, walkFiles } from "../fs-support.js";

import { readExtensionManifests } from "../extension-manifests.js";
import { isRecord } from "../config-support.js";

const docs = "https://shopify.dev/docs/api/checkout-ui-extensions";
const pageDocs = "https://shopify.dev/docs/api/customer-account-ui-extensions";
const shopifyLimitKb = 64;
/** Full-page customer account extensions get a larger deployment limit; reviewed on shopify.dev 2026-09-24. */
const fullPageLimitKb = 128;
const fullPageTargets = new Set(["customer-account.page.render", "customer-account.order.page.render"]);

function targets(extensions: readonly Record<string, unknown>[]): readonly string[] {
  return extensions
    .filter((entry) => entry.type === "ui_extension" && Array.isArray(entry.targeting))
    .flatMap((entry) => entry.targeting as unknown[])
    .filter(isRecord)
    .map((target) => target.target)
    .filter((target): target is string => typeof target === "string");
}

/**
 * Mirrors the bundle limit Shopify CLI enforces at deploy, as a fast CI pre-check.
 *
 * @attribution https://shopify.dev/docs/api/checkout-ui-extensions (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/customer-account-ui-extensions (inspiration; independently implemented)
 */
export const checkoutBundleSize: ConformanceCheck = {
  id: "checkout-bundle-size",
  description:
    "Checkout and full-page customer account extension dist JavaScript totals stay within their raw-byte budgets; Shopify CLI remains the deployment authority.",
  docs,
  async run(options) {
    const { checkoutBundleLimitKb } = options;
    const limitKb = checkoutBundleLimitKb ?? shopifyLimitKb;
    if (!Number.isFinite(limitKb) || limitKb <= 0 || limitKb > shopifyLimitKb)
      throw new Error("checkoutBundleLimitKb must be greater than zero and at most 64 KB.");
    const { manifests, findings } = await readExtensionManifests(options, "checkout-bundle-size", docs);
    for (const manifest of manifests) {
      const extensionRoot = path.dirname(manifest.path);
      const extensionName = path.basename(extensionRoot);
      const declared = targets(manifest.extensions);
      const checkout = declared.some((target) => target.startsWith("purchase.checkout."));
      if (!checkout && !declared.some((target) => fullPageTargets.has(target))) continue;
      const budgetKb = checkout ? limitKb : fullPageLimitKb;
      const hardLimitKb = checkout ? shopifyLimitKb : fullPageLimitKb;
      const surface = checkout ? "Checkout extension" : "Full-page customer account extension";
      const surfaceDocs = checkout ? docs : pageDocs;
      const distRoot = path.join(extensionRoot, "dist");
      const bundleFiles = await walkFiles(distRoot, { extensions: [".js"], maxDepth: 10 });
      if (bundleFiles.length === 0) {
        findings.push({
          check: "checkout-bundle-size",
          severity: "error",
          path: distRoot,
          message: `${surface} "${extensionName}" has no built JavaScript; build before checking its budget.`,
          docs: surfaceDocs,
        });
        continue;
      }
      let totalBytes = 0;
      for (const bundleFile of bundleFiles) {
        totalBytes += await fileSize(bundleFile);
      }

      if (totalBytes <= budgetKb * 1024 || totalBytes === 0) continue;
      findings.push({
        check: "checkout-bundle-size",
        severity: "error",
        message: `${surface} "${extensionName}" compiled bundle is ${Math.round(totalBytes / 1024)} KB, above the ${budgetKb} KB budget (Shopify's deployment limit is ${hardLimitKb} KB).`,
        path: distRoot,
        docs: surfaceDocs,
      });
    }

    return findings;
  },
};
