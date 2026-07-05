import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const skippedDirectories = new Set(["node_modules", ".git", "dist", "build", ".shopify"]);

export async function readTextFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

export async function listDirectory(directoryPath: string): Promise<readonly string[]> {
  try {
    return await readdir(directoryPath);
  } catch {
    return [];
  }
}

export async function isDirectory(entryPath: string): Promise<boolean> {
  try {
    return (await stat(entryPath)).isDirectory();
  } catch {
    return false;
  }
}

export async function fileSize(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}

export type WalkOptions = {
  readonly extensions: readonly string[];
  readonly maxDepth: number;
};

export async function walkFiles(root: string, options: WalkOptions): Promise<readonly string[]> {
  const results: string[] = [];

  async function walk(directoryPath: string, depth: number): Promise<void> {
    if (depth > options.maxDepth) return;
    for (const entry of await listDirectory(directoryPath)) {
      if (skippedDirectories.has(entry) || entry.startsWith(".")) continue;
      const entryPath = path.join(directoryPath, entry);
      if (await isDirectory(entryPath)) {
        await walk(entryPath, depth + 1);
        continue;
      }
      if (options.extensions.some((extension) => entry.endsWith(extension))) {
        results.push(entryPath);
      }
    }
  }

  await walk(root, 0);
  return results;
}
