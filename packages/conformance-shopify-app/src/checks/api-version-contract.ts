import { glob } from "node:fs/promises";
import nodePath from "node:path";
import { isRecord, readAppConfigurations } from "../config-support.js";
import { readExtensionManifests } from "../extension-manifests.js";
import type { AdminApiPaths, ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "../finding.js";
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

type Source = { readonly path: string; readonly text: string };

const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const adminApiPath = /\/admin\/api\/([^/\s"'`]+)\//gu;
const identifier = /^[A-Za-z_$][\w$]*$/u;

/**
 * Reads the project-relative script files that `patterns` select, comments removed. An explicit pattern that
 * matches no file is reported under `field`.
 */
async function readSources(
  root: string,
  patterns: readonly string[],
  {
    explicit,
    field,
    remedy,
    skipTests,
  }: { readonly explicit: boolean; readonly field: string; readonly remedy: string; readonly skipTests: boolean },
  findings: ConformanceFinding[],
): Promise<readonly Source[]> {
  const files = new Set<string>();
  for (const pattern of patterns) {
    let matched = false;
    for await (const file of glob(pattern.replaceAll("\\", "/"), { cwd: root, exclude: ["**/node_modules/**"] })) {
      if (/\.(?:[cm]?[jt]sx?)$/u.test(file) && !file.endsWith(".d.ts") && !(skipTests && testFile.test(file))) {
        files.add(file.replaceAll("\\", "/"));
        matched = true;
      }
    }
    if (explicit && !matched)
      findings.push({
        check: "api-version-contract",
        docs,
        path: pattern,
        severity: "error",
        message: `${field}: ${pattern} matches no source file. ${remedy}`,
      });
  }
  const sources: Source[] = [];
  for (const file of [...files].toSorted()) {
    const text = ((await readTextFile(nodePath.join(root, file))) ?? "").replace(
      /\/\*[\s\S]*?\*\/|(?<![:"'`\w])\/\/[^\n]*/gu,
      " ",
    );
    sources.push({ path: file, text });
  }
  return sources;
}

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
  const sources = await readSources(
    options.root,
    explicit ?? defaultServerEntries,
    {
      explicit: explicit !== undefined,
      field: "serverEntries",
      remedy: "Select the module that configures the Shopify app server.",
      skipTests: false,
    },
    findings,
  );
  const versions: { path: string; version: string }[] = [];
  for (const source of sources) {
    for (const match of source.text.matchAll(serverApiVersion)) {
      const version =
        match[1] !== undefined && match[2] !== undefined
          ? `20${match[2]}-${enumMonths[match[1]]}`
          : (match[4] ?? "unstable");
      versions.push({ path: source.path, version });
    }
  }
  return versions;
}

/**
 * Every `/admin/api/<segment>/` path in the selected sources must name the app's API version, literally or as
 * `${constant}`; the constant's literal declaration in the same sources must name it too.
 */
async function inspectAdminApiPaths(
  root: string,
  { sources: patterns, constant }: AdminApiPaths,
  appVersions: readonly { readonly manifest: string; readonly version: string }[],
  inspect: (value: unknown, path: string, field: string) => void,
  findings: ConformanceFinding[],
): Promise<void> {
  if (
    !Array.isArray(patterns) ||
    patterns.length === 0 ||
    patterns.some((entry) => typeof entry !== "string" || entry.trim() === "")
  )
    throw new Error("adminApiPaths.sources must contain nonempty project-relative paths or glob patterns.");
  if (constant !== undefined && !identifier.test(constant))
    throw new Error("adminApiPaths.constant must be the JavaScript identifier that holds the Admin API version.");
  const report = (message: string, path?: string): void => {
    findings.push({
      check: "api-version-contract",
      docs,
      severity: "error",
      message,
      ...(path === undefined ? {} : { path }),
    });
  };
  const [app] = appVersions;
  if (app === undefined) {
    report(
      "adminApiPaths: No selected app manifest declares [webhooks] api_version, so Admin API paths have no app version to agree with. Declare it in the app manifest.",
    );
    return;
  }
  const sources = await readSources(
    root,
    patterns,
    {
      explicit: true,
      field: "adminApiPaths.sources",
      remedy: "Select the modules that build Admin API URLs.",
      skipTests: true,
    },
    findings,
  );
  const placeholder = constant === undefined ? undefined : "${" + constant + "}";
  let paths = 0;
  for (const source of sources) {
    const reported = new Set<string>();
    for (const match of source.text.matchAll(adminApiPath)) {
      paths += 1;
      const segment = match[1] ?? "";
      const differing = appVersions.find((candidate) => candidate.version !== segment);
      if (segment === placeholder || differing === undefined || reported.has(segment)) continue;
      reported.add(segment);
      report(
        `/admin/api/${segment}/: The Admin API path names ${segment} while ${differing.manifest} declares ${differing.version} in [webhooks] api_version. Write ${placeholder ?? differing.version} so every Admin call uses the app's API version.`,
        source.path,
      );
    }
  }
  if (paths === 0 && sources.length > 0)
    report(
      "adminApiPaths: The selected sources contain no /admin/api/<version>/ path. Select the modules that build Admin API URLs.",
    );
  if (constant === undefined) return;
  const declaration = new RegExp(
    String.raw`(?<![\w$])${constant.replaceAll("$", "\\$")}\s*(?::\s*[\w.]+\s*)?[=:]\s*(["'` +
      "`" +
      String.raw`])(20\d{2}-\d{2}|unstable)\1`,
    "gu",
  );
  let declared = false;
  for (const source of sources) {
    for (const match of source.text.matchAll(declaration)) {
      declared = true;
      const version = match[2] ?? "";
      inspect(version, source.path, constant);
      for (const candidate of appVersions) {
        if (candidate.version !== version)
          report(
            `${constant}: The constant holds ${version} while ${candidate.manifest} declares ${candidate.version} in [webhooks] api_version. Set it to the app's API version.`,
            source.path,
          );
      }
    }
  }
  if (!declared)
    report(
      `adminApiPaths.constant: ${constant} has no literal API version declaration in the selected sources. Declare it there, for example const ${constant} = "${app.version}".`,
    );
}

/**
 * @attribution https://shopify.dev/docs/api/usage/versioning (inspiration; independently implemented)
 * @attribution https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/app/loader.ts (MIT concept; independently implemented)
 */
export const apiVersionContract: ConformanceCheck = {
  id: "api-version-contract",
  description:
    "Webhook, app server, versioned extension, and opted-in Admin API path versions must use quarterly version syntax, satisfy explicit version bounds, and agree with the webhook manifest.",
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
    const appVersions = configurations.flatMap(({ path, config }) => {
      const version = isRecord(config.webhooks) ? config.webhooks.api_version : undefined;
      return typeof version === "string" ? [{ manifest: path, version }] : [];
    });
    for (const manifest of extensions.manifests) {
      const unified = manifest.config.extensions !== undefined;
      for (const [index, entry] of manifest.extensions.entries()) {
        const version = Object.hasOwn(entry, "api_version") ? entry.api_version : manifest.config.api_version;
        const field = unified ? `extensions[${index}].api_version` : "api_version";
        if (version !== undefined || entry.type === "ui_extension" || entry.type === "function")
          inspect(version, manifest.path, field);
        if (typeof version !== "string") continue;
        for (const app of appVersions) {
          if (app.version === version) continue;
          findings.push({
            check: "api-version-contract",
            docs,
            path: manifest.path,
            severity: "error",
            message: `${field}: The extension uses API version ${version} while ${app.manifest} declares ${app.version} in [webhooks] api_version. Move every extension to the app's API version so the app and its extensions share one schema.`,
          });
        }
      }
    }
    if (options.adminApiPaths !== undefined)
      await inspectAdminApiPaths(options.root, options.adminApiPaths, appVersions, inspect, findings);
    return findings;
  },
};
