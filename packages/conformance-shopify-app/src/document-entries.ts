import path from "node:path";
import type { ConformanceRunOptions } from "./finding.js";
import { walkFiles } from "./fs-support.js";

const documentBasenames = new Set(["index.html", "root.tsx", "root.jsx", "__root.tsx", "__root.jsx"]);

/**
 * Resolves the App Home documents to inspect: `documentEntries` when set, otherwise common HTML and JSX root
 * layouts up to four levels deep. Explicit entries must stay inside the project; an empty list throws.
 */
export async function documentEntries({
  root,
  documentEntries: explicit,
}: ConformanceRunOptions): Promise<readonly string[]> {
  if (explicit === undefined)
    return (await walkFiles(root, { extensions: [".html", ".tsx", ".jsx"], maxDepth: 4 })).filter((filePath) =>
      documentBasenames.has(path.basename(filePath)),
    );
  const resolved = explicit.map((entry) => {
    const relative = path.relative(path.resolve(root), path.resolve(root, entry));
    if (entry === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new Error("documentEntries must name project-relative document files inside the project.");
    return path.resolve(root, entry);
  });
  if (resolved.length === 0) throw new Error("documentEntries must include at least one document.");
  return [...new Set(resolved)];
}

/** Removes HTML and block comments so commented-out markup cannot count as evidence. */
export function withoutComments(content: string): string {
  return content.replaceAll(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, "");
}
