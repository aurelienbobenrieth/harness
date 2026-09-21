import { readdir, readFile, stat } from "node:fs/promises";

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

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function isDirectory(entryPath: string): Promise<boolean> {
  try {
    return (await stat(entryPath)).isDirectory();
  } catch {
    return false;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJson(content: string | undefined): unknown {
  if (content === undefined) return undefined;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}
