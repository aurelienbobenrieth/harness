import path from "node:path";
import type { ConformanceCheck } from "../finding.js";
import { fileSize, walkFiles } from "../fs-support.js";

import { readExtensionManifests } from "../extension-manifests.js";
import { isRecord } from "../config-support.js";

const docs = "https://shopify.dev/docs/api/checkout-ui-extensions";
const shopifyLimitKb = 64;

/** @attribution https://shopify.dev/docs/api/checkout-ui-extensions (inspiration; independently implemented) */
export const checkoutBundleSize: ConformanceCheck = {
  id: "checkout-bundle-size",
  description:
    "Checkout extension dist JavaScript totals stay within the configured raw-byte budget; Shopify CLI remains the deployment authority.",
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
      if (
        !manifest.extensions.some(
          (entry) =>
            entry.type === "ui_extension" &&
            Array.isArray(entry.targeting) &&
            entry.targeting.some(
              (target) =>
                isRecord(target) && typeof target.target === "string" && target.target.startsWith("purchase.checkout."),
            ),
        )
      )
        continue;
      const distRoot = path.join(extensionRoot, "dist");
      const bundleFiles = await walkFiles(distRoot, { extensions: [".js"], maxDepth: 10 });
      if (bundleFiles.length === 0) {
        findings.push({
          check: "checkout-bundle-size",
          severity: "error",
          path: distRoot,
          message: `Checkout extension "${extensionName}" has no built JavaScript; build before checking its budget.`,
          docs,
        });
        continue;
      }
      let totalBytes = 0;
      for (const bundleFile of bundleFiles) {
        totalBytes += await fileSize(bundleFile);
      }

      if (totalBytes <= limitKb * 1024 || totalBytes === 0) continue;
      findings.push({
        check: "checkout-bundle-size",
        severity: "error",
        message: `Extension "${extensionName}" compiled bundle is ${Math.round(totalBytes / 1024)} KB, above the ${limitKb} KB budget (Shopify's deployment limit is ${shopifyLimitKb} KB).`,
        path: distRoot,
        docs,
      });
    }

    return findings;
  },
};
