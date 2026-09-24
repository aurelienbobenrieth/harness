/**
 * Environments never inherit bindings, `vars`, `define`, or `secrets`: a key declared at the top level and
 * omitted from `env.<name>` deploys that environment without it. Wrangler only prints a warning; this check
 * makes it a failure, and also names each top-level binding or variable an environment forgot.
 *
 * The key list follows Wrangler's configuration validation (workers-sdk commit fc3cbaa, 2026-09-24), a
 * superset of the documented list; `unsafe*` keys are left out.
 *
 * @attribution https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys (inspiration; independently implemented)
 * @attribution https://github.com/cloudflare/workers-sdk/blob/fc3cbaa4150a3cf30502286452153806bf8800d2/packages/workers-utils/src/config/validation.ts (Apache-2.0 OR MIT fact source; key list only, independently implemented)
 */
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord, loadWranglerConfigs } from "../wrangler-config.js";

const id = "environment-bindings-redeclared";
const docs = "https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys";

const nonInheritableKeys = [
  "define",
  "vars",
  "secrets",
  "durable_objects",
  "workflows",
  "kv_namespaces",
  "cloudchamber",
  "containers",
  "send_email",
  "queues",
  "connect",
  "r2_buckets",
  "d1_databases",
  "vectorize",
  "ai_search_namespaces",
  "ai_search",
  "agent_memory",
  "hyperdrive",
  "services",
  "analytics_engine_datasets",
  "dispatch_namespaces",
  "mtls_certificates",
  "tail_consumers",
  "streaming_tail_consumers",
  "browser",
  "ai",
  "images",
  "stream",
  "media",
  "pipelines",
  "secrets_store_secrets",
  "artifacts",
  "flagship",
  "worker_loaders",
  "ratelimits",
  "vpc_services",
  "vpc_networks",
  "version_metadata",
] as const;

function entryName(entry: unknown): string | undefined {
  if (!isRecord(entry)) return undefined;
  for (const field of ["binding", "name", "service", "queue"]) {
    const value = entry[field];
    if (typeof value === "string" && value !== "") return value;
  }
  return undefined;
}

function namesOf(entries: unknown, prefix = ""): readonly string[] {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    const name = entryName(entry);
    return name === undefined ? [] : [`${prefix}${name}`];
  });
}

/** Names a key declares, when its shape is known; undefined falls back to key presence alone. */
function declaredNames(key: string, value: unknown): readonly string[] | undefined {
  if (key === "vars" || key === "define") return isRecord(value) ? Object.keys(value) : undefined;
  if (key === "secrets")
    return isRecord(value) && Array.isArray(value["required"])
      ? value["required"].filter((name): name is string => typeof name === "string")
      : undefined;
  if (key === "queues" && isRecord(value))
    return [...namesOf(value["producers"]), ...namesOf(value["consumers"], "consumer ")];
  if (Array.isArray(value)) return namesOf(value);
  if (isRecord(value)) return Array.isArray(value["bindings"]) ? namesOf(value["bindings"]) : namesOf([value]);
  return undefined;
}

function isEmpty(value: unknown): boolean {
  return (Array.isArray(value) && value.length === 0) || (isRecord(value) && Object.keys(value).length === 0);
}

export const environmentBindingsRedeclared: ConformanceCheck = {
  id,
  description:
    "Every named environment redeclares the non-inheritable keys (bindings, vars, define, secrets) present at the top level.",
  docs,
  async run(options) {
    const { configs, findings } = await loadWranglerConfigs(options, id, docs);
    const results: ConformanceFinding[] = [...findings];
    for (const config of configs) {
      for (const key of nonInheritableKeys) {
        const topValue = config.top[key];
        if (topValue === undefined || isEmpty(topValue)) continue;
        const topNames = declaredNames(key, topValue) ?? [];
        for (const environment of config.environments) {
          const envValue = environment.own[key];
          const missing =
            envValue === undefined
              ? []
              : topNames.filter((name) => !(declaredNames(key, envValue) ?? topNames).includes(name));
          if (envValue !== undefined && missing.length === 0) continue;
          const name = environment.label.slice("env.".length);
          results.push({
            check: id,
            docs,
            path: config.path,
            severity: "error",
            message:
              envValue === undefined
                ? `${environment.label} omits "${key}". Environments do not inherit it, so the ${name} Worker deploys without it. Redeclare "${key}" under ${environment.label}.`
                : `${environment.label}.${key} is missing ${missing.join(", ")} declared at the top level. Environments do not inherit them: redeclare each under ${environment.label}.${key}.`,
          });
        }
      }
    }
    return results;
  },
};
