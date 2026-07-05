import path from "node:path";
import { readTextFile } from "./fs-support.js";
import { parseJson } from "./liquid-support.js";

export type RegistrySurface = "merchant" | "internal" | "preset" | "contract";
export type RegistryDelivery = "block" | "compound" | "snippet" | "section" | "enhancer" | "adapter";

export type RegistryEntry = {
  readonly id: string;
  readonly name?: string;
  readonly status: string;
  readonly surface?: RegistrySurface;
  readonly delivery?: RegistryDelivery;
  readonly path?: string;
};

export type Registry = {
  readonly primitives: readonly RegistryEntry[];
};

export const implementedStatuses = new Set(["implemented", "direct-plus", "refactor"]);

export async function loadRegistry(root: string, registryPath = "registry.json"): Promise<Registry | undefined> {
  const content = await readTextFile(path.join(root, registryPath));
  if (content === undefined) return undefined;
  const parsed = parseJson<Registry | readonly RegistryEntry[]>(content);
  if (parsed === undefined) return undefined;
  if (Array.isArray(parsed)) return { primitives: parsed };
  const primitives = (parsed as Registry).primitives;
  return Array.isArray(primitives) ? { primitives } : undefined;
}
