/**
 * Requires Workers Logs (`observability.enabled: true`) for the top-level Worker and for every environment
 * that overrides `observability`. Environments inherit the key, so one that omits it shares the top-level
 * result. Traces are deliberately not required: they are in beta and billed separately.
 *
 * @attribution https://developers.cloudflare.com/workers/observability/logs/workers-logs/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
 */
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord, loadWranglerConfigs, overridingEnvironments } from "../wrangler-config.js";

const id = "observability-enabled";
const docs = "https://developers.cloudflare.com/workers/observability/logs/workers-logs/";

export const observabilityEnabled: ConformanceCheck = {
  id,
  description: "The Worker and every environment that overrides observability set observability.enabled to true.",
  docs,
  async run(options) {
    const { configs, findings } = await loadWranglerConfigs(options, id, docs);
    const results: ConformanceFinding[] = [...findings];
    for (const config of configs) {
      const targets = [{ label: "top level", own: config.top }, ...overridingEnvironments(config, ["observability"])];
      for (const target of targets) {
        const observability = target.own["observability"];
        if (isRecord(observability) && observability["enabled"] === true) continue;
        results.push({
          check: id,
          docs,
          path: config.path,
          severity: "error",
          message: `${target.label}: observability.enabled is not true, so this Worker's logs are not persisted. Set "observability": { "enabled": true }.`,
        });
      }
    }
    return results;
  },
};
