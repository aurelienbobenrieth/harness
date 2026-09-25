import { glob } from "node:fs/promises";
import nodePath from "node:path";
import { isRecord, readAppConfigurations } from "../config-support.js";
import { readExtensionManifests } from "../extension-manifests.js";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "../finding.js";
import { readTextFile } from "../fs-support.js";

const docs = "https://shopify.dev/docs/api/usage/versioning";
const stableVersion = /^20\d{2}-(?:01|04|07|10)$/u;
const defaultServerEntries = ["shopify.server.*", "app/shopify.server.*", "src/shopify.server.*"];
const serverApiVersion =
  /\bapiVersion\s*:\s*(?:ApiVersion\s*\.\s*(January|April|July|October)(\d{2})\b|(["'`])(20\d{2}-\d{2}|unstable)\3|ApiVersion\s*\.\s*(Unstable)\b)/gu;
const enumMonths: Readonly<Record<string, string>> = {
  January: "01",
  April: "04",
  July: "07",
  October: "10",
};

/**
 * Reads literal `apiVersion` properties from app server entries. `ApiVersion.July26` resolves by the
 * enum's month-and-year naming; `LATEST_API_VERSION` and other dynamic values are not resolved.
 */
async function serverApiVersions(
  options: ConformanceRunOptions,
  findings: ConformanceFinding[],
): Promise<readonly { readonly path: string; readonly version: string }[]> {
  const explicit = options.serverEntries;
  if (explicit?.some((entry) => typeof entry !== "string" || entry.trim() === ""))
    throw new Error("serverEntries must contain nonempty project-relative paths.");
  const files = new Set<string>();
  for (const pattern of explicit ?? defaultServerEntries) {
    let matched = false;
    for await (const file of glob(pattern.replaceAll("\\", "/"), {
      cwd: options.root,
      exclude: ["**/node_modules/**"],
    })) {
      if (/\.(?:[cm]?[jt]sx?)$/u.test(file) && !file.endsWith(".d.ts")) {
        files.add(file.replaceAll("\\", "/"));
        matched = true;
      }
    }
    if (explicit !== undefined && !matched)
      findings.push({
        check: "api-version-contract",
        docs,
        path: pattern,
        severity: "error",
        message: `serverEntries: ${pattern} matches no source file. Select the module that configures the Shopify app server.`,
      });
  }
  const versions: { path: string; version: string }[] = [];
  for (const file of [...files].toSorted()) {
    const source = ((await readTextFile(nodePath.join(options.root, file))) ?? "").replace(
      /\/\*[\s\S]*?\*\/|(?<![:"'`\w])\/\/[^\n]*/gu,
      " ",
    );
    for (const match of source.matchAll(serverApiVersion)) {
      const version =
        match[1] !== undefined && match[2] !== undefined
          ? `20${match[2]}-${enumMonths[match[1]]}`
          : (match[4] ?? "unstable");
      versions.push({ path: file, version });
    }
  }
  return versions;
}

/**
 * @attribution https://shopify.dev/docs/api/usage/versioning (inspiration; independently implemented)
 * @attribution https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/app/loader.ts (MIT concept; independently implemented)
 */
export const apiVersionContract: ConformanceCheck = {
  id: "api-version-contract",
  description:
    "Webhook, app server, and versioned extension API versions must use quarterly version syntax, satisfy explicit version bounds, and agree between the app server and the webhook manifest.",
  docs,
  async run(options) {
    const { minimumApiVersion, maximumApiVersion } = options;
    if (
      (minimumApiVersion !== undefined && !stableVersion.test(minimumApiVersion)) ||
      (maximumApiVersion !== undefined && !stableVersion.test(maximumApiVersion)) ||
      (minimumApiVersion !== undefined && maximumApiVersion !== undefined && minimumApiVersion > maximumApiVersion)
    )
      throw new Error(
        "API version bounds must be ordered quarterly versions in YYYY-01, YYYY-04, YYYY-07, or YYYY-10 form.",
      );
    const { configurations, findings } = await readAppConfigurations(options, "api-version-contract", docs);
    const inspect = (value: unknown, path: string, field: string): void => {
      const report = (message: string, severity: ConformanceFinding["severity"] = "error"): void => {
        findings.push({
          check: "api-version-contract",
          docs,
          path,
          severity,
          message: `${field}: ${message}`,
        });
      };
      if (value === "unstable") {
        report(
          "Unstable API contracts can change without notice. Select a reviewed stable version for production.",
          minimumApiVersion !== undefined || maximumApiVersion !== undefined ? "error" : "warning",
        );
        return;
      }
      if (typeof value !== "string" || !stableVersion.test(value)) {
        report("Declare a quarterly API version in YYYY-01, YYYY-04, YYYY-07, or YYYY-10 form.");
        return;
      }
      if (minimumApiVersion !== undefined && value < minimumApiVersion)
        report(
          `Version ${value} is below the configured minimum ${minimumApiVersion}. Upgrade and verify the changed API contract.`,
        );
      if (maximumApiVersion !== undefined && value > maximumApiVersion)
        report(
          `Version ${value} is above the configured maximum ${maximumApiVersion}. Select an API version reviewed for this deployment.`,
        );
    };
    for (const { path, config } of configurations) {
      if (config.webhooks !== undefined)
        inspect(isRecord(config.webhooks) ? config.webhooks.api_version : undefined, path, "webhooks.api_version");
    }
    for (const server of await serverApiVersions(options, findings)) {
      inspect(server.version, server.path, "apiVersion");
      for (const { path: manifest, config } of configurations) {
        const webhookVersion = isRecord(config.webhooks) ? config.webhooks.api_version : undefined;
        if (typeof webhookVersion !== "string" || webhookVersion === server.version) continue;
        findings.push({
          check: "api-version-contract",
          docs,
          path: server.path,
          severity: "warning",
          message: `apiVersion: The app server requests Admin API ${server.version} while ${manifest} delivers webhooks at ${webhookVersion}. Align both so webhook payloads and Admin queries share one schema.`,
        });
      }
    }
    const extensions = await readExtensionManifests(options, "api-version-contract", docs);
    for (const finding of extensions.findings) {
      if (!findings.some((existing) => existing.path === finding.path && existing.message === finding.message))
        findings.push(finding);
    }
    for (const manifest of extensions.manifests) {
      const unified = manifest.config.extensions !== undefined;
      for (const [index, entry] of manifest.extensions.entries()) {
        const version = Object.hasOwn(entry, "api_version") ? entry.api_version : manifest.config.api_version;
        if (version !== undefined || entry.type === "ui_extension" || entry.type === "function")
          inspect(version, manifest.path, unified ? `extensions[${index}].api_version` : "api_version");
      }
    }
    return findings;
  },
};
