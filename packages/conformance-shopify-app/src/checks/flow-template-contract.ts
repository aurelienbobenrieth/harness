import { stat } from "node:fs/promises";
import path from "node:path";
import { appManifests } from "../app-manifests.js";
import { isRecord } from "../config-support.js";
import { readExtensionManifests } from "../extension-manifests.js";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { hasTranslation, parseLocale } from "../locale-support.js";

const id = "flow-template-contract";
const docs = "https://shopify.dev/docs/apps/build/flow/templates/reference";
/** Reviewed on shopify.dev 2026-09-24. */
const categories = new Set([
  "buyer_experience",
  "customers",
  "inventory_and_merch",
  "loyalty",
  "orders",
  "promotion",
  "risk",
  "fulfillment",
  "b2b",
  "payment_reminders",
  "custom_data",
  "error_monitoring",
]);
const recommendedCategories = 2;
const templatesPerApp = 25;
const booleanFields = ["require_app", "discoverable", "enabled", "allow_one_click_activate"] as const;

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function countTemplates(manifests: readonly { readonly extensions: readonly Record<string, unknown>[] }[]): number {
  return manifests.flatMap((manifest) => manifest.extensions).filter((entry) => entry.type === "flow_template").length;
}

/** Counts per deployment so one environment's templates never count against another's limit. */
async function overLimit(
  options: ConformanceRunOptions,
  pooled: number,
): Promise<readonly { readonly deployment?: string; readonly count: number }[]> {
  if (pooled <= templatesPerApp) return [];
  const deployments = options.appManifest === undefined ? await appManifests(options) : [];
  if (deployments.length <= 1) return [{ count: pooled }];
  const counts = await Promise.all(
    deployments.map(async (deployment) => ({
      deployment,
      count: countTemplates(
        (await readExtensionManifests({ ...options, appManifest: deployment }, id, docs)).manifests,
      ),
    })),
  );
  return counts.filter(({ count }) => count > templatesPerApp);
}

/**
 * Structural preflight for Flow template extensions: required TOML fields, documented categories, a module
 * inside the extension, the locale files the approval checklist names, and the per-app template limit.
 * Workflow value, titles, spelling, and one-click safety stay with Shopify's template review.
 *
 * @attribution https://shopify.dev/docs/apps/build/flow/templates/reference (inspiration; independently implemented)
 */
export const flowTemplateContract: ConformanceCheck = {
  id,
  description:
    "Flow template extensions must declare a valid handle, documented categories, an existing workflow module, and default plus English locales resolving their t: keys.",
  docs,
  async run(options) {
    const { manifests, findings } = await readExtensionManifests(options, id, docs);
    for (const manifest of manifests) {
      const templates = manifest.extensions.filter((entry) => entry.type === "flow_template");
      if (templates.length === 0) continue;
      const extensionRoot = path.dirname(manifest.path);
      const report = (message: string, severity: ConformanceFinding["severity"] = "error", at = manifest.path) =>
        findings.push({ check: id, docs, path: at, severity, message });
      const translationKeys = new Set<string>();
      for (const entry of templates) {
        const label = nonempty(entry.handle) ? `Flow template "${entry.handle}"` : "Flow template";
        if (!nonempty(entry.handle) || !/^[A-Za-z0-9-]+$/u.test(entry.handle))
          report(
            `${label}: set handle to letters, digits, and hyphens only; it cannot change after app dev or deploy.`,
          );
        for (const field of ["name", "description"] as const) {
          const value = entry[field];
          if (!nonempty(value)) report(`${label}: set a nonempty ${field}.`);
          else if (value.startsWith("t:")) translationKeys.add(value.slice(2));
        }
        const template = entry.template;
        if (!isRecord(template)) {
          report(`${label}: declare an [extensions.template] table with categories and module.`);
          continue;
        }
        const declared = template.categories;
        if (!Array.isArray(declared) || declared.length === 0)
          report(`${label}: set template.categories to a nonempty array of documented categories.`);
        else {
          const unknown = declared.filter((category) => typeof category !== "string" || !categories.has(category));
          if (unknown.length > 0)
            report(
              `${label}: template.categories contains ${unknown.map((category) => JSON.stringify(category)).join(", ")}. Use only ${[...categories].join(", ")}.`,
            );
          if (declared.length > recommendedCategories)
            report(
              `${label}: template.categories lists ${declared.length} categories; Shopify recommends at most ${recommendedCategories}.`,
              "warning",
            );
        }
        const module = template.module;
        if (!nonempty(module)) report(`${label}: set template.module to the exported workflow file.`);
        else {
          const resolved = path.resolve(extensionRoot, module);
          const relative = path.relative(extensionRoot, resolved);
          if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
            report(`${label}: template.module ${module} must point inside the extension directory.`);
          else if (!(await isFile(resolved)))
            report(`${label}: template.module ${module} does not exist. Export the workflow from Flow into this path.`);
        }
        for (const field of booleanFields)
          if (template[field] !== undefined && typeof template[field] !== "boolean")
            report(`${label}: template.${field} must be true or false.`);
      }

      const localesRoot = path.join(extensionRoot, "locales");
      const localeFiles = (await listDirectory(localesRoot)).filter((entry) => entry.endsWith(".json")).toSorted();
      const defaults = localeFiles.filter((entry) => entry.endsWith(".default.json"));
      if (defaults.length !== 1) {
        report(
          `Flow template locales/ has ${defaults.length} default locale files; ship exactly one <lang>.default.json as the fallback.`,
          "error",
          localesRoot,
        );
        continue;
      }
      if (!localeFiles.some((entry) => /^en(?:-[A-Za-z0-9]+)*(?:\.default)?\.json$/u.test(entry)))
        report(
          "Flow template locales/ has no English translation; add en.json or en.default.json.",
          "error",
          localesRoot,
        );
      for (const localeFile of localeFiles) {
        const localePath = path.join(localesRoot, localeFile);
        const locale = parseLocale((await readTextFile(localePath)) ?? "");
        const isDefault = localeFile.endsWith(".default.json");
        if (locale === undefined) {
          report(`Flow template locale file ${localeFile} is not a valid JSON object.`, "error", localePath);
          continue;
        }
        for (const key of translationKeys)
          if (!hasTranslation(locale, key))
            report(
              `Flow template locale file ${localeFile} is missing the "${key}" key referenced from ${path.basename(manifest.path)}.`,
              isDefault ? "error" : "warning",
              localePath,
            );
      }
    }
    for (const { deployment, count } of await overLimit(options, countTemplates(manifests)))
      findings.push({
        check: id,
        docs,
        ...(deployment === undefined ? {} : { path: deployment }),
        severity: "error",
        message: `${deployment ?? "The app"} declares ${count} Flow templates; Shopify accepts at most ${templatesPerApp} per app.`,
      });
    return findings;
  },
};
