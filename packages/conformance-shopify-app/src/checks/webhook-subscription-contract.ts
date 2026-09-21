import { isHttpsUrl, isRecord, readAppConfigurations } from "../config-support.js";
import type { ConformanceCheck } from "../finding.js";

const docs = "https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#subscriptions";
const complianceTopics = new Set(["customers/data_request", "customers/redact", "shop/redact"]);

/** Validates supported transport syntax; cloud resource existence and webhook authentication are separate checks. */
function isDeliveryUri(value: unknown): boolean {
  if (typeof value !== "string" || /[\s\\]/u.test(value)) return false;
  if (isHttpsUrl(value)) return new URL(value).hash === "";
  if (/^\/(?!\/)/u.test(value)) return !value.includes("#");
  if (/^pubsub:\/\/[^/:?#]+:[^/:?#]+$/u.test(value)) return true;
  return /^arn:aws(?:-[a-z]+)*:events:[a-z0-9-]+::event-source\/aws\.partner\/shopify\.com\/[^/\s?#]+\/[^/\s?#]+$/u.test(
    value,
  );
}

/** @attribution https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration (inspiration; independently implemented) */
export const webhookSubscriptionContract: ConformanceCheck = {
  id: "webhook-subscription-contract",
  description: "Declared webhook subscriptions must pair nonempty topic arrays with a supported delivery URI.",
  docs,
  async run(options) {
    const { configurations, findings } = await readAppConfigurations(options, "webhook-subscription-contract", docs);
    for (const { path, config } of configurations) {
      if (config.webhooks === undefined) continue;
      const report = (field: string, message: string): void => {
        findings.push({
          check: "webhook-subscription-contract",
          docs,
          path,
          severity: "error",
          message: `${path} ${field}: ${message}`,
        });
      };
      if (!isRecord(config.webhooks)) {
        report("webhooks", "Use a TOML table for webhook configuration.");
        continue;
      }
      const subscriptions = config.webhooks.subscriptions;
      if (subscriptions === undefined) continue;
      if (!Array.isArray(subscriptions)) {
        report("webhooks.subscriptions", "Declare subscriptions with [[webhooks.subscriptions]] array tables.");
        continue;
      }
      for (const [index, subscription] of subscriptions.entries()) {
        const field = `webhooks.subscriptions[${index}]`;
        if (!isRecord(subscription)) {
          report(field, "Use a TOML table for each subscription.");
          continue;
        }
        if (!isDeliveryUri(subscription.uri))
          report(
            `${field}.uri`,
            "Set an HTTPS URL, root-relative path, Google Pub/Sub URI, or Shopify EventBridge ARN without a fragment.",
          );
        if (subscription.topics === undefined && subscription.compliance_topics === undefined)
          report(field, "Declare at least one topics or compliance_topics entry.");
        for (const key of ["topics", "compliance_topics"] as const) {
          const topics = subscription[key];
          if (topics === undefined) continue;
          if (
            !Array.isArray(topics) ||
            topics.length === 0 ||
            topics.some((topic) => typeof topic !== "string" || topic.trim() === "" || topic.trim() !== topic)
          )
            report(`${field}.${key}`, "Use a nonempty array of nonempty topic strings.");
          else if (key === "compliance_topics" && topics.some((topic) => !complianceTopics.has(topic as string)))
            report(`${field}.${key}`, "Use only Shopify's three supported privacy compliance topics.");
        }
      }
    }
    return findings;
  },
};
