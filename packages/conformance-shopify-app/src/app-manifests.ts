import path from "node:path";
import { listDirectory } from "./fs-support.js";
import type { ConformanceRunOptions } from "./finding.js";

const appConfigPattern = /^shopify\.app(?:\.[A-Za-z0-9_-]+)?\.toml$/;

/**
 * Resolves a CLI-compatible root deployment manifest, preserving missing explicit selections for reporting.
 * @attribution https://github.com/Shopify/cli/blob/614187e5204ca6c4bc3c8418b8c6fcb224ab5dae/packages/app/src/cli/models/project/project.ts (MIT concept; independently implemented)
 */
export async function appManifests({ root, appManifest }: ConformanceRunOptions): Promise<readonly string[]> {
  if (appManifest !== undefined) {
    const relative = path.relative(path.resolve(root), path.resolve(root, appManifest)).replaceAll("\\", "/");
    if (!appConfigPattern.test(relative))
      throw new Error(
        "appManifest must name a root shopify.app[.environment].toml file; environment names use ASCII letters, digits, hyphens, or underscores.",
      );
    return [relative];
  }
  return (await listDirectory(root)).filter((entry) => appConfigPattern.test(entry)).toSorted();
}
