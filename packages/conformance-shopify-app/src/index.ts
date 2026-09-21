import { appBridgeScript } from "./checks/app-bridge-script.js";
import { checkoutBundleSize } from "./checks/checkout-bundle-size.js";
import { complianceWebhooks } from "./checks/compliance-webhooks.js";
import { functionsLocalization } from "./checks/functions-localization.js";
import { appUrlSecurity } from "./checks/app-url-security.js";
import { apiVersionContract } from "./checks/api-version-contract.js";
import { webhookSubscriptionContract } from "./checks/webhook-subscription-contract.js";
import { builtForShopifyExtensions } from "./checks/built-for-shopify-extensions.js";
import { listingInputs } from "./checks/listing-inputs.js";
import { extensionCapabilityContract } from "./checks/extension-capability-contract.js";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "./finding.js";
import { appManifests } from "./app-manifests.js";

export type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions, ConformanceSeverity } from "./finding.js";
export { appBridgeScript } from "./checks/app-bridge-script.js";
export { checkoutBundleSize } from "./checks/checkout-bundle-size.js";
export { complianceWebhooks } from "./checks/compliance-webhooks.js";
export { functionsLocalization } from "./checks/functions-localization.js";
export { appUrlSecurity } from "./checks/app-url-security.js";
export { apiVersionContract } from "./checks/api-version-contract.js";
export { webhookSubscriptionContract } from "./checks/webhook-subscription-contract.js";
export { builtForShopifyExtensions } from "./checks/built-for-shopify-extensions.js";
export { extensionCapabilityContract } from "./checks/extension-capability-contract.js";
export { listingInputs, type ShopifyAppListing, type ShopifyListingImage } from "./checks/listing-inputs.js";
export type { BuiltForShopifyCategory } from "./finding.js";
export {
  evaluateShopifyStorefrontPerformance,
  type ShopifyStorefrontRun,
  type ShopifyStorefrontPerformanceResult,
} from "./storefront-performance-evidence.js";
export {
  evaluateShopifyPerformance,
  shopifyPerformanceCriteria,
  type ShopifyPerformanceMetric,
  type ShopifyPerformanceMeasurement,
  type ShopifyPerformanceReport,
  type ShopifyPerformanceResult,
} from "./performance-evidence.js";
export { evaluateShopifyIframeProtection, probeShopifyWebhookHmac } from "./http-contracts.js";
export type { ShopifyIframeProtectionOptions, ShopifyWebhookHmacProbeOptions } from "./http-contracts.js";

export const shopifyAppChecks: readonly ConformanceCheck[] = [
  complianceWebhooks,
  appBridgeScript,
  functionsLocalization,
  checkoutBundleSize,
  appUrlSecurity,
  webhookSubscriptionContract,
  apiVersionContract,
  builtForShopifyExtensions,
  listingInputs,
];

/**
 * Checks that are registered but excluded from the default run. Pass them explicitly, for example
 * `shopifyAppConformance(options, [...shopifyAppChecks, ...optionalShopifyAppChecks])`.
 */
export const optionalShopifyAppChecks: readonly ConformanceCheck[] = [extensionCapabilityContract];

export type ShopifyAppConformanceReport = {
  /** Selected manifest paths, including missing manifests reported in findings. */
  readonly appManifests: readonly string[];
  readonly findings: readonly ConformanceFinding[];
};

/** Includes deployment selection evidence; the findings remain a static preflight, not deployed acceptance. */
export async function runShopifyAppConformanceReport(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = shopifyAppChecks,
): Promise<ShopifyAppConformanceReport> {
  return {
    appManifests: await appManifests(options),
    findings: await runShopifyAppConformance(options, checks),
  };
}

/** Runs the default checks, or exactly the supplied list when opting into optional checks. */
export async function runShopifyAppConformance(
  options: ConformanceRunOptions,
  checks: readonly ConformanceCheck[] = shopifyAppChecks,
): Promise<readonly ConformanceFinding[]> {
  const findings: ConformanceFinding[] = [];
  for (const check of checks) {
    findings.push(...(await check.run(options)));
  }
  return findings;
}
