import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";
import { implementedStatuses, loadRegistry } from "../registry-support.js";

const docs = "https://github.com/aurelienbbn/harness#conformance-shopify-theme";

export const registrySync: ConformanceCheck = {
  id: "registry-sync",
  description: "registry.json and disk stay in sync: implemented entries have files, no unregistered blocks/sections.",
  docs,
  async run({ root, registryPath }) {
    const findings: ConformanceFinding[] = [];
    const registry = await loadRegistry(root, registryPath);
    if (registry === undefined) {
      findings.push({
        check: "registry-sync",
        severity: "error",
        message: `${registryPath ?? "registry.json"} is missing or not valid JSON: the registry is the source of truth for primitives.`,
        docs,
      });
      return findings;
    }

    const registeredPaths = new Set<string>();
    for (const entry of registry.primitives) {
      if (typeof entry.path === "string") registeredPaths.add(entry.path.replaceAll("\\", "/"));

      if (!implementedStatuses.has(entry.status)) continue;
      if (entry.path === undefined) {
        findings.push({
          check: "registry-sync",
          severity: "error",
          message: `registry entry "${entry.id}" is ${entry.status} but declares no path.`,
          docs,
        });
        continue;
      }
      const content = await readTextFile(path.join(root, entry.path));
      if (content !== undefined) continue;
      findings.push({
        check: "registry-sync",
        severity: "error",
        message: `registry entry "${entry.id}" is ${entry.status} but ${entry.path} does not exist.`,
        path: entry.path,
        docs,
      });
    }

    for (const directory of ["blocks", "sections"]) {
      for (const entry of await listDirectory(path.join(root, directory))) {
        if (!entry.endsWith(".liquid")) continue;
        const relativePath = `${directory}/${entry}`;
        if (registeredPaths.has(relativePath)) continue;
        findings.push({
          check: "registry-sync",
          severity: "error",
          message: `${relativePath} is not referenced by any registry entry: register it or remove it.`,
          path: relativePath,
          docs,
        });
      }
    }

    return findings;
  },
};
