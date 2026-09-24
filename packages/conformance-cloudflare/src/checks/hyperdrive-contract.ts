/**
 * The contract between a Worker's database driver and Hyperdrive:
 *
 * - a TCP driver (`pg`, `postgres`, `mysql2`) in the Worker's package implies a `hyperdrive` binding;
 * - the installed (else declared) driver version meets Hyperdrive's documented minimum;
 * - Node.js compatibility is on, which every driver needs;
 * - no `localConnectionString` commits a password (the per-binding environment variable exists for that);
 * - the PlanetScale serverless driver is not used alongside Hyperdrive.
 *
 * Minimums reviewed 2026-09-24 against pages last updated 2026-04-21.
 *
 * @attribution https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/mysql-drivers-and-libraries/mysql2/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/hyperdrive/configuration/local-development/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/mysql-database-providers/planetscale/ (inspiration; independently implemented)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { nodeCompatibility, parseCompatibilityDate } from "../compatibility.js";
import { isRecord, loadWranglerConfigs, type WranglerConfig } from "../wrangler-config.js";

const id = "hyperdrive-contract";
const docs = "https://developers.cloudflare.com/hyperdrive/";

const driverMinimums: Readonly<Record<string, readonly [number, number, number]>> = {
  pg: [8, 16, 3],
  postgres: [3, 4, 5],
  mysql2: [3, 13, 0],
};
const planetscaleServerless = "@planetscale/database";
const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies"] as const;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

type Version = readonly [number, number, number];

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function parseVersion(text: string): Version | undefined {
  const match = /^\s*(?:\^|~|>=|=)?\s*v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]*)?\s*$/u.exec(text);
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
}

function below(version: Version, minimum: Version): boolean {
  for (const index of [0, 1, 2] as const) if (version[index] !== minimum[index]) return version[index] < minimum[index];
  return false;
}

/** The version Node would load from `directory`, walking node_modules upward but never above `root`. */
async function installedVersion(directory: string, root: string, name: string): Promise<string | undefined> {
  for (let current = directory; ; current = path.dirname(current)) {
    const manifest = await readJson(path.join(current, "node_modules", name, "package.json"));
    if (isRecord(manifest) && typeof manifest["version"] === "string") return manifest["version"];
    if (current === root || path.dirname(current) === current) return undefined;
  }
}

function hyperdriveEntries(config: WranglerConfig): readonly { readonly label: string; readonly entry: unknown }[] {
  return [{ label: "top level", own: config.top }, ...config.environments].flatMap((target) => {
    const list = target.own["hyperdrive"];
    return Array.isArray(list) ? list.map((entry: unknown) => ({ label: target.label, entry })) : [];
  });
}

function committedPassword(entry: unknown): "remote" | "loopback" | undefined {
  if (!isRecord(entry) || typeof entry["localConnectionString"] !== "string") return undefined;
  try {
    const url = new URL(entry["localConnectionString"]);
    if (url.password === "") return undefined;
    return loopbackHosts.has(url.hostname) ? "loopback" : "remote";
  } catch {
    return undefined;
  }
}

export const hyperdriveContract: ConformanceCheck = {
  id,
  description:
    "A Worker using pg, postgres, or mysql2 has a Hyperdrive binding, a supported driver version and Node.js compatibility; no committed localConnectionString password; no PlanetScale serverless driver behind Hyperdrive.",
  docs,
  async run(options) {
    const { configs, findings } = await loadWranglerConfigs(options, id, docs);
    const results: ConformanceFinding[] = [...findings];
    for (const config of configs) {
      const add = (finding: Omit<ConformanceFinding, "check" | "docs" | "path"> & { readonly docs?: string }): void => {
        results.push({ check: id, docs, path: config.path, ...finding });
      };
      const entries = hyperdriveEntries(config);
      for (const { label, entry } of entries) {
        const exposure = committedPassword(entry);
        if (exposure === undefined) continue;
        const binding = isRecord(entry) && typeof entry["binding"] === "string" ? entry["binding"] : "<BINDING>";
        add({
          severity: exposure === "remote" ? "error" : "warning",
          docs: "https://developers.cloudflare.com/hyperdrive/configuration/local-development/",
          message: `${label}: hyperdrive binding ${binding} commits a ${exposure === "remote" ? "database" : "local database"} password in localConnectionString. Remove it and set CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${binding} in your untracked environment instead.`,
        });
      }

      const manifestPath = path.join(config.directory, "package.json");
      const manifest = await readJson(manifestPath);
      if (!isRecord(manifest)) {
        add({
          severity: "warning",
          evaluation: "unsupported",
          message: `No readable package.json next to ${config.path}, so the Worker's database drivers are unknown. Add one or point wranglerConfigs at the Worker's own config.`,
        });
        continue;
      }
      const declared = new Map<string, string>();
      for (const field of dependencyFields) {
        const block = manifest[field];
        if (isRecord(block))
          for (const [name, spec] of Object.entries(block)) if (typeof spec === "string") declared.set(name, spec);
      }

      if (declared.has(planetscaleServerless) && entries.length > 0)
        add({
          severity: "error",
          docs: "https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/mysql-database-providers/planetscale/",
          message: `${planetscaleServerless} is installed next to a Hyperdrive binding. Hyperdrive pools TCP connections, which that HTTP driver bypasses: query through pg, postgres, or mysql2 instead.`,
        });

      const drivers = Object.keys(driverMinimums).filter((name) => declared.has(name));
      if (drivers.length === 0) continue;
      if (entries.length === 0)
        add({
          severity: "error",
          message: `The Worker depends on ${drivers.join(", ")} but declares no hyperdrive binding. Direct connections from Workers are neither pooled nor cached: add a "hyperdrive" binding and connect through it.`,
        });

      for (const driver of drivers) {
        const minimum = driverMinimums[driver] ?? [0, 0, 0];
        const installed = await installedVersion(config.directory, path.resolve(options.root), driver);
        const source = installed ?? declared.get(driver) ?? "";
        const version = parseVersion(source);
        if (version === undefined) {
          add({
            severity: "warning",
            evaluation: "unsupported",
            message: `${driver} is not installed and its declared range ${JSON.stringify(source)} has no plain lower bound, so its Hyperdrive minimum ${minimum.join(".")} was not verified. Install dependencies before running this check.`,
          });
          continue;
        }
        if (below(version, minimum))
          add({
            severity: "error",
            message: `${driver} ${installed === undefined ? `range ${source}` : installed} is below Hyperdrive's minimum ${minimum.join(".")}. Upgrade it to ${minimum.join(".")} or later.`,
          });
      }

      const date = parseCompatibilityDate(config.top["compatibility_date"]);
      const compat = date === undefined ? undefined : nodeCompatibility(date, config.top["compatibility_flags"]);
      if (compat === "disabled" || compat === "missing-flag")
        add({
          severity: "error",
          message: `${drivers.join(", ")} need Node.js compatibility, which this config leaves off. Remove no_nodejs_compat, or add nodejs_compat when compatibility_date predates 2026-08-04.`,
        });
    }
    return results;
  },
};
