import path from "node:path";
import { appManifests } from "./app-manifests.js";
import { readTextFile } from "./fs-support.js";
import { parseToml } from "./toml-support.js";
import type { ConformanceFinding, ConformanceRunOptions } from "./finding.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type AppConfiguration = {
  readonly path: string;
  readonly config: Record<string, unknown>;
};

export async function readAppConfigurations(
  options: ConformanceRunOptions,
  check: string,
  docs: string,
): Promise<{
  readonly configurations: readonly AppConfiguration[];
  readonly findings: ConformanceFinding[];
}> {
  const configurations: AppConfiguration[] = [];
  const findings: ConformanceFinding[] = [];
  for (const manifest of await appManifests(options)) {
    const text = await readTextFile(path.join(options.root, manifest));
    const config = text === undefined ? undefined : parseToml(text);
    if (config === undefined) {
      findings.push({
        check,
        docs,
        path: manifest,
        severity: "error",
        message: `${manifest} is missing, unreadable, or invalid TOML. Restore a valid selected deployment manifest.`,
      });
    } else configurations.push({ path: manifest, config });
  }
  return { configurations, findings };
}

/** Checks declared transport only; certificates, reachability, and server behavior require live evidence. */
export function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() !== value || /[\s\\]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      value.toLowerCase().startsWith("https://") &&
      url.protocol === "https:" &&
      url.hostname !== "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}
