import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const functionType = /^\s*type\s*=\s*["']function["']/m;

function manifestsIn(directory: string): readonly string[] {
  try {
    return readdirSync(directory)
      .filter((name) => name.endsWith(".extension.toml"))
      .map((name) => path.join(directory, name));
  } catch {
    return [];
  }
}

function readManifest(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Builds a per-process cached lookup: does the nearest ancestor directory holding a `*.extension.toml`
 * manifest satisfy `test`? A directory with several manifests matches when any of them does. Files
 * outside every extension resolve to `false`.
 */
function nearestManifestMatches(test: (manifest: string) => boolean): (filename: string) => boolean {
  const cache = new Map<string, boolean>();
  return (filename) => {
    const visited: string[] = [];
    let directory = path.dirname(path.resolve(filename));
    let result = false;
    for (;;) {
      const cached = cache.get(directory);
      if (cached !== undefined) {
        result = cached;
        break;
      }
      visited.push(directory);
      const manifests = manifestsIn(directory);
      if (manifests.length > 0) {
        result = manifests.some((manifest) => test(readManifest(manifest)));
        break;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    for (const entry of visited) cache.set(entry, result);
    return result;
  };
}

/** True under an extension whose manifest declares `type = "function"`. */
export const isShopifyFunctionSource = nearestManifestMatches((manifest) => functionType.test(manifest));
