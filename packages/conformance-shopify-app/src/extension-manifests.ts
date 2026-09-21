import { glob, realpath } from "node:fs/promises";
import path from "node:path";
import { isRecord, readAppConfigurations } from "./config-support.js";
import { readTextFile } from "./fs-support.js";
import { parseToml } from "./toml-support.js";
import type { ConformanceRunOptions } from "./finding.js";

type ExtensionManifest = {
  readonly path: string;
  readonly config: Record<string, unknown>;
  readonly extensions: readonly Record<string, unknown>[];
};

/**
 * @attribution https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration (inspiration; independently implemented)
 * @attribution https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/project/config-selection.ts (MIT concept; independently implemented)
 */
export async function readExtensionManifests(options: ConformanceRunOptions, check: string, docs: string) {
  const { configurations, findings } = await readAppConfigurations(options, check, docs);
  const patterns = new Set<string>();
  if (configurations.length === 0 && findings.length === 0) patterns.add("extensions/*");
  for (const { path: manifest, config } of configurations) {
    const configured = config.extension_directories ?? [];
    if (!Array.isArray(configured) || configured.some((entry) => typeof entry !== "string" || entry === "")) {
      findings.push({
        check,
        docs,
        path: manifest,
        severity: "error",
        message: `${manifest} extension_directories must be an array of project-relative directory paths or glob patterns.`,
      });
      continue;
    }
    for (const value of configured.length === 0 ? ["extensions/*"] : (configured as string[])) {
      const pattern = value.replaceAll("\\", "/").replace(/\/+$/u, "");
      if (
        pattern === "" ||
        path.isAbsolute(pattern) ||
        /^[A-Za-z]:/u.test(pattern) ||
        pattern.split("/").includes("..") ||
        pattern.startsWith("!")
      ) {
        findings.push({
          check,
          docs,
          path: manifest,
          severity: "error",
          message: `${manifest} extension_directories must stay inside the project and use positive directory patterns.`,
        });
      } else patterns.add(pattern);
    }
  }
  const projectRoot = await realpath(options.root);
  const files = new Set<string>();
  for (const pattern of patterns) {
    for await (const file of glob(`${pattern}/*.extension.toml`, {
      cwd: options.root,
      exclude: ["**/node_modules/**"],
    })) {
      const absolute = path.resolve(options.root, file);
      const resolved = await realpath(absolute);
      const relative = path.relative(projectRoot, resolved);
      if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
        findings.push({
          check,
          docs,
          path: file,
          severity: "error",
          message:
            "Extension configuration resolves outside the selected project. Keep checked extension files inside the project.",
        });
      } else files.add(absolute);
    }
  }
  const manifests: ExtensionManifest[] = [];
  for (const file of [...files].toSorted()) {
    const text = await readTextFile(file);
    const config = text === undefined ? undefined : parseToml(text);
    if (config === undefined)
      findings.push({
        check,
        docs,
        path: file,
        severity: "error",
        message: "Extension configuration is unreadable or invalid TOML. Restore a valid extension manifest.",
      });
    else {
      const entries = config.extensions === undefined ? [config] : config.extensions;
      if (!Array.isArray(entries) || entries.some((entry) => !isRecord(entry)))
        findings.push({
          check,
          docs,
          path: file,
          severity: "error",
          message: "Declare extensions using [[extensions]] tables or a supported legacy root extension table.",
        });
      else manifests.push({ path: file, config, extensions: entries as Record<string, unknown>[] });
    }
  }
  return { manifests, findings };
}
