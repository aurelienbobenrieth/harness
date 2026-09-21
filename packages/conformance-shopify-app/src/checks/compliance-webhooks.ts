import { parseToml } from "../toml-support.js";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile } from "../fs-support.js";
import { appManifests } from "../app-manifests.js";

const docs = "https://shopify.dev/docs/apps/build/privacy-law-compliance";
const requiredTopics = ["customers/data_request", "customers/redact", "shop/redact"] as const;
export const complianceWebhooks: ConformanceCheck = {
  id: "compliance-webhooks",
  description: "Apps must subscribe to the three mandatory privacy compliance webhook topics.",
  docs,
  async run(options) {
    const { root } = options;
    const findings: ConformanceFinding[] = [];
    const configFiles = await appManifests(options);

    if (configFiles.length === 0) {
      return [
        {
          check: "compliance-webhooks",
          severity: "warning",
          message:
            "No shopify.app.toml found: verify the mandatory compliance webhooks (customers/data_request, customers/redact, shop/redact) are registered another way.",
          docs,
        },
      ];
    }

    for (const configFile of configFiles) {
      const content = await readTextFile(path.join(root, configFile));
      if (content === undefined) {
        findings.push({
          check: "compliance-webhooks",
          severity: "error",
          path: configFile,
          message: `Selected app manifest ${configFile} is missing. Restore it or select the intended deployment configuration.`,
          docs,
        });
        continue;
      }
      const config = parseToml(content);
      if (config === undefined) {
        findings.push({
          check: "compliance-webhooks",
          severity: "error",
          message: `${configFile} is not valid TOML.`,
          path: configFile,
          docs,
        });
        continue;
      }
      const webhooks = config.webhooks;
      const subscriptions = isRecord(webhooks) && Array.isArray(webhooks.subscriptions) ? webhooks.subscriptions : [];
      const topics = new Set(
        subscriptions.flatMap((subscription) => {
          if (!isRecord(subscription) || !Array.isArray(subscription.compliance_topics)) return [];
          if (typeof subscription.uri !== "string" || subscription.uri.trim() === "") return [];
          return subscription.compliance_topics.filter((topic): topic is string => typeof topic === "string");
        }),
      );
      for (const topic of requiredTopics) {
        if (topics.has(topic)) continue;
        findings.push({
          check: "compliance-webhooks",
          severity: "error",
          message: `${configFile} must declare compliance topic "${topic}" in webhooks.subscriptions with a nonempty uri. Source mentions and other deployments do not register this webhook.`,
          path: configFile,
          docs,
        });
      }
    }
    return findings;
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
