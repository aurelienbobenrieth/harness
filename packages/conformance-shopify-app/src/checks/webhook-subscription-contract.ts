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

const eventActions = new Set(["create", "update", "delete"]);

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim() !== "" && item.trim() === item)
  );
}

/** Developer-preview `[events]` contract as documented on 2026-09-24; subscription validity stays with deploy. */
function inspectEvents(events: unknown, report: (field: string, message: string) => void): void {
  if (!isRecord(events)) {
    report("events", "Use a TOML table for Events configuration.");
    return;
  }
  if (typeof events.api_version !== "string" || events.api_version.trim() === "")
    report("events.api_version", "Declare the API version Events runs subscription queries against.");
  const subscriptions = events.subscription;
  if (subscriptions === undefined) return;
  if (!Array.isArray(subscriptions)) {
    report("events.subscription", "Declare subscriptions with [[events.subscription]] array tables.");
    return;
  }
  const handles = new Set<string>();
  for (const [index, subscription] of subscriptions.entries()) {
    const field = `events.subscription[${index}]`;
    if (!isRecord(subscription)) {
      report(field, "Use a TOML table for each subscription.");
      continue;
    }
    const { handle, topic, actions, triggers, query, query_filter: queryFilter } = subscription;
    if (typeof handle !== "string" || !/^[A-Za-z0-9_-]{1,50}$/u.test(handle))
      report(`${field}.handle`, "Set a handle of 1-50 letters, digits, underscores, or hyphens.");
    else if (handles.has(handle))
      report(`${field}.handle`, `Handle "${handle}" is already used; make each handle unique.`);
    else handles.add(handle);
    if (typeof topic !== "string" || !/^[A-Z][A-Za-z0-9]*$/u.test(topic))
      report(
        `${field}.topic`,
        "Set a capitalized GraphQL Admin resource name such as Product. Classic topics like products/update and privacy compliance topics stay in [[webhooks.subscriptions]].",
      );
    if (
      !isStringList(actions) ||
      actions.some((action) => !eventActions.has(action)) ||
      new Set(actions).size !== actions.length
    )
      report(`${field}.actions`, "Use a nonempty array of distinct create, update, or delete actions.");
    if (triggers !== undefined && !isStringList(triggers))
      report(`${field}.triggers`, "Use a nonempty array of field path strings.");
    else if (triggers === undefined && Array.isArray(actions) && actions.includes("update"))
      report(`${field}.triggers`, "Subscriptions with the update action need a triggers array of field paths.");
    if (!isDeliveryUri(subscription.uri))
      report(
        `${field}.uri`,
        "Set an HTTPS URL, root-relative path, Google Pub/Sub URI, or Shopify EventBridge ARN without a fragment.",
      );
    if (query !== undefined && (typeof query !== "string" || query.trim() === ""))
      report(`${field}.query`, "Use a nonempty GraphQL Admin API query string.");
    if (queryFilter !== undefined) {
      if (typeof queryFilter !== "string" || queryFilter.trim() === "")
        report(`${field}.query_filter`, "Use a nonempty filter expression.");
      else if (query === undefined)
        report(`${field}.query_filter`, "A query_filter needs a query whose result it filters.");
    }
  }
}

/**
 * @attribution https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/events/subscribe (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/events (inspiration; independently implemented)
 */
export const webhookSubscriptionContract: ConformanceCheck = {
  id: "webhook-subscription-contract",
  description:
    "Declared webhook subscriptions, and opted-in Events subscriptions, must pair nonempty topics with a supported delivery URI.",
  docs,
  async run(options) {
    const { configurations, findings } = await readAppConfigurations(options, "webhook-subscription-contract", docs);
    for (const { path, config } of configurations) {
      const report = (field: string, message: string): void => {
        findings.push({
          check: "webhook-subscription-contract",
          docs,
          path,
          severity: "error",
          message: `${path} ${field}: ${message}`,
        });
      };
      if (options.nextGenerationEvents === true && config.events !== undefined) inspectEvents(config.events, report);
      if (config.webhooks === undefined) continue;
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
