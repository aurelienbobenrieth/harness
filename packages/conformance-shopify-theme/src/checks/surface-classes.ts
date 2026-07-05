import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile } from "../fs-support.js";
import { hasDocTag, hasSchemaTag, parseSchema } from "../liquid-support.js";
import { implementedStatuses, loadRegistry, type RegistryEntry } from "../registry-support.js";

const docs = "https://github.com/aurelienbbn/harness#conformance-shopify-theme";
const defaultSettingsBudget = 25;
const groupingThreshold = 8;

function finding(check: string, message: string, entryPath?: string): ConformanceFinding {
  return { check, severity: "error", message, docs, ...(entryPath === undefined ? {} : { path: entryPath }) };
}

async function entryContent(root: string, entry: RegistryEntry): Promise<string | undefined> {
  if (entry.path === undefined) return undefined;
  return readTextFile(path.join(root, entry.path));
}

export const surfaceClasses: ConformanceCheck = {
  id: "surface-classes",
  description: "Registry surface/delivery classification is present and its invariants hold on disk.",
  docs,
  async run({ root, registryPath, settingsBudget }) {
    const findings: ConformanceFinding[] = [];
    const registry = await loadRegistry(root, registryPath);
    if (registry === undefined) return findings; // registry-sync reports the missing registry

    const budget = settingsBudget ?? defaultSettingsBudget;

    for (const entry of registry.primitives) {
      if (!implementedStatuses.has(entry.status)) continue;

      if (entry.surface === undefined || entry.delivery === undefined) {
        findings.push(
          finding(
            "surface-classes",
            `registry entry "${entry.id}" is ${entry.status} but lacks surface/delivery classification.`,
          ),
        );
        continue;
      }

      const content = await entryContent(root, entry);

      if (entry.surface === "merchant" && entry.delivery === "block") {
        if (content === undefined) continue;
        const schema = parseSchema(content);
        const presets = schema?.presets ?? [];
        if (presets.length === 0) {
          findings.push(
            finding(
              "surface-merchant-preset",
              `merchant block "${entry.id}" ships no presets: merchants cannot add it from the editor.`,
              entry.path,
            ),
          );
        }
        const settings = schema?.settings ?? [];
        const settingCount = settings.filter((setting) => setting.id !== undefined).length;
        if (settingCount > budget) {
          findings.push(
            finding(
              "surface-merchant-budget",
              `merchant block "${entry.id}" exposes ${settingCount} settings (budget ${budget}).`,
              entry.path,
            ),
          );
        }
        if (settingCount > groupingThreshold && !settings.some((setting) => setting.type === "header")) {
          findings.push(
            finding(
              "surface-merchant-budget",
              `merchant block "${entry.id}" has ${settingCount} settings without header grouping.`,
              entry.path,
            ),
          );
        }
      }

      if (entry.surface === "internal" && entry.delivery === "snippet" && content !== undefined) {
        if (hasSchemaTag(content)) {
          findings.push(
            finding(
              "surface-internal-hidden",
              `internal snippet "${entry.id}" declares a {% schema %}: internal primitives never surface in the editor.`,
              entry.path,
            ),
          );
        }
        if (!hasDocTag(content)) {
          findings.push(
            finding("surface-internal-hidden", `internal snippet "${entry.id}" has no {% doc %} header.`, entry.path),
          );
        }
      }

      if (entry.surface === "preset" && entry.path !== undefined && entry.path.endsWith(".liquid")) {
        findings.push(
          finding(
            "surface-preset-thin",
            `preset "${entry.id}" points at ${entry.path}: presets only configure existing primitives, never own markup.`,
            entry.path,
          ),
        );
      }

      if (entry.delivery === "enhancer" && content !== undefined && /\binnerHTML\s*=/.test(content)) {
        findings.push(
          finding(
            "surface-enhancer-thin",
            `enhancer "${entry.id}" writes innerHTML: enhancers never own first-render markup.`,
            entry.path,
          ),
        );
      }
    }

    return findings;
  },
};
