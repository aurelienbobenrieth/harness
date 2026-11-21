import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants } from "node:zlib";
import type { ConformanceCheck } from "../finding.js";
import { walkFiles } from "../fs-support.js";

import { readExtensionManifests } from "../extension-manifests.js";
import { isRecord } from "../config-support.js";

const docs = "https://shopify.dev/docs/apps/build/app-extensions/optimize-bundle-size";
/** Shopify's compressed limit per UI extension; full-page customer account extensions get 128 KB. Reviewed on shopify.dev 2026-11-21. */
const shopifyLimitKb = 64;
const fullPageLimitKb = 128;
const compress = promisify(brotliCompress);

/**
 * Brotli size at quality 11, the estimate Shopify CLI prints after a build. shopify.dev states the limit as
 * compressed without naming the algorithm, so this mirrors the CLI rather than the deploy service.
 */
async function compressedSize(file: string): Promise<number> {
  const bytes = await readFile(file);
  return (await compress(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })).byteLength;
}

function kb(bytes: number): string {
  return (bytes / 1024).toFixed(1);
}
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
 * Mirrors the compressed bundle limit Shopify enforces per extension at deploy, as a fast CI pre-check.
 *
 * @attribution https://shopify.dev/docs/apps/build/app-extensions/optimize-bundle-size (inspiration; independently implemented)
 */
export const checkoutBundleSize: ConformanceCheck = {
  id: "checkout-bundle-size",
  description:
    "Checkout and full-page customer account extension dist JavaScript, brotli-compressed as Shopify CLI estimates it, stays within the compressed size limit; Shopify's deploy remains the authority.",
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
      const distRoot = path.join(extensionRoot, "dist");
      const bundleFiles = await walkFiles(distRoot, { extensions: [".js"], maxDepth: 10 });
      if (bundleFiles.length === 0) {
        findings.push({
          check: "checkout-bundle-size",
          severity: "error",
          path: distRoot,
          message: `${surface} "${extensionName}" has no built JavaScript; build before checking its budget.`,
          docs,
        });
        continue;
      }
      let compressedBytes = 0;
      for (const bundleFile of bundleFiles) {
        compressedBytes += await compressedSize(bundleFile);
      }

      if (compressedBytes <= budgetKb * 1024) continue;
      findings.push({
        check: "checkout-bundle-size",
        severity: "error",
        message: `${surface} "${extensionName}" bundle is ${kb(compressedBytes)} KB compressed, above the ${budgetKb} KB budget (Shopify rejects more than ${hardLimitKb} KB compressed at deploy). Drop runtime libraries and whole-module imports until it fits.`,
        path: distRoot,
        docs,
      });
    }

    return findings;
  },
};
