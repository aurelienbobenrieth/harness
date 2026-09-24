import path from "node:path";
import { appManifests } from "../app-manifests.js";
import { isRecord, readAppConfigurations } from "../config-support.js";
import { readExtensionManifests } from "../extension-manifests.js";
import { readTextFile, walkFiles } from "../fs-support.js";
import type { BuiltForShopifyCategory, ConformanceCheck } from "../finding.js";

const docs = "https://shopify.dev/docs/apps/launch/built-for-shopify/requirements";
const categories = new Set<BuiltForShopifyCategory>([
  "advertising",
  "email-marketing",
  "forms",
  "sms-marketing",
  "invoices",
  "product-reviews",
  "returns",
  "subscriptions",
]);
/** BFS 5.12.4 and 5.14.5, effective 2026-12-01 per https://shopify.dev/changelog/built-for-shopify-requirements-for-returns-and-exchanges-and-subscription-apps */
const customerAccountApiRequirements: Partial<Record<BuiltForShopifyCategory, string>> = {
  returns: "5.12.4",
  subscriptions: "5.14.5",
};
const segmentRequirements = {
  advertising: "5.1.2",
  "email-marketing": "5.6.3",
  forms: "5.7.1",
  "sms-marketing": "5.13.3",
};

/**
 * @attribution https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration (inspiration; independently implemented)
 * @attribution https://shopify.dev/changelog/built-for-shopify-requirements-for-returns-and-exchanges-and-subscription-apps (inspiration; independently implemented)
 */
export const builtForShopifyExtensions: ConformanceCheck = {
  id: "built-for-shopify-extensions",
  description:
    "Explicit Built for Shopify categories require their declared extension types and insertion targets; presence is only a prerequisite.",
  docs,
  async run(options) {
    const selected = options.builtForShopifyCategories ?? [];
    for (const category of selected)
      if (!categories.has(category))
        throw new Error(
          `Unsupported Built for Shopify category: ${category}. Select a documented category with static extension prerequisites.`,
        );
    if (selected.length === 0) return [];
    if (options.appManifest === undefined) {
      const deployments = await appManifests(options);
      if (deployments.length > 1) {
        const findings = [];
        for (const appManifest of deployments)
          findings.push(
            ...(await builtForShopifyExtensions.run({ ...options, appManifest })).map((finding) => ({
              ...finding,
              message: `${appManifest}: ${finding.message}`,
            })),
          );
        return findings;
      }
    }
    const { manifests, findings } = await readExtensionManifests(options, "built-for-shopify-extensions", docs);
    const extensions = manifests.flatMap((manifest) => manifest.extensions);
    const targets = new Set(
      extensions
        .filter((entry) => entry.type === "ui_extension")
        .flatMap((entry) =>
          Array.isArray(entry.targeting)
            ? entry.targeting
                .filter(isRecord)
                .map((target) => target.target)
                .filter((target): target is string => typeof target === "string")
            : [],
        ),
    );
    const require = (condition: boolean, requirement: string, message: string): void => {
      if (!condition)
        findings.push({
          check: "built-for-shopify-extensions",
          docs,
          severity: "error",
          message: `Built for Shopify ${requirement}: ${message} Extension presence does not prove the required workflow works.`,
        });
    };
    const customerAuthentication = (
      await readAppConfigurations(options, "built-for-shopify-extensions", docs)
    ).configurations.some(
      ({ config }) =>
        isRecord(config.customer_authentication) &&
        Array.isArray(config.customer_authentication.redirect_uris) &&
        config.customer_authentication.redirect_uris.length > 0,
    );
    const customerAccountTarget = [...targets].some(
      (target) => target.startsWith("customer-account.") && target.endsWith(".render"),
    );
    for (const category of new Set(selected)) {
      const customerAccountApi = customerAccountApiRequirements[category];
      if (customerAccountApi !== undefined)
        require(customerAuthentication ||
          customerAccountTarget, customerAccountApi, "Configure [customer_authentication] redirect_uris for the Customer Account API or ship a customer account UI extension, then verify buyer self-service signs in through the Customer Account API (required from 2026-12-01).");
      if (Object.hasOwn(segmentRequirements, category))
        require(targets.has("admin.customer-segment-details.action.render"), segmentRequirements[
          category as keyof typeof segmentRequirements
        ], "Declare a customer segment action extension for this category.");
      if (category === "invoices") {
        require(targets.has(
          "admin.order-details.print-action.render",
        ), "5.9.1", "Declare an order details print action extension.");
        require(targets.has(
          "admin.order-index.selection-print-action.render",
        ), "5.9.1", "Declare an order selection print action extension.");
      }
      if (category === "product-reviews") {
        require(extensions.some(
          (entry) => entry.type === "flow_trigger",
        ), "5.11.1", "Declare a Flow trigger, then verify that each new review starts the workflow.");
        require(targets.has(
          "admin.customer-details.block.render",
        ), "5.11.2", "Declare a customer details block extension for customer reviews.");
      }
      if (category === "subscriptions") {
        require(customerAccountTarget, "5.14.4", "Declare a Customer Account UI extension, then verify subscription management.");
        let hasProductBlock = false;
        for (const manifest of manifests) {
          if (!manifest.extensions.some((entry) => entry.type === "theme")) continue;
          for (const file of await walkFiles(path.join(path.dirname(manifest.path), "blocks"), {
            extensions: [".liquid"],
            maxDepth: 0,
          })) {
            if (isProductAppBlock((await readTextFile(file)) ?? "")) hasProductBlock = true;
          }
        }
        require(hasProductBlock, "5.14.2", "Ship a theme app block with a literal section schema that permits product templates.");
      }
    }
    return findings;
  },
};

/** Inspects literal schema JSON only; Shopify Theme Check and served product-page review remain required. */
function isProductAppBlock(source: string): boolean {
  const active = source.replaceAll(/\{%-?\s*(comment|raw)\s*-?%\}[\s\S]*?\{%-?\s*end\1\s*-?%\}/gu, "");
  const schemas = [...active.matchAll(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/gu)];
  if (schemas.length !== 1) return false;
  try {
    const schema: unknown = JSON.parse(schemas[0]?.[1] ?? "");
    if (!isRecord(schema) || schema.target !== "section") return false;
    if (schema.enabled_on !== undefined && schema.disabled_on !== undefined) return false;
    for (const key of ["enabled_on", "disabled_on"] as const) {
      const restriction = schema[key];
      if (restriction === undefined) continue;
      if (!isRecord(restriction)) return false;
      if (restriction.templates === undefined) continue;
      if (
        !Array.isArray(restriction.templates) ||
        restriction.templates.some((template) => typeof template !== "string")
      )
        return false;
      const permitsProduct = restriction.templates.includes("product") || restriction.templates.includes("*");
      if (key === "enabled_on" && !permitsProduct) return false;
      if (key === "disabled_on" && permitsProduct) return false;
    }
    return true;
  } catch {
    return false;
  }
}
