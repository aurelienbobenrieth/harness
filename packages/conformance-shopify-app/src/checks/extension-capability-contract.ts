import path from "node:path";
import { isRecord } from "../config-support.js";
import { readExtensionManifests } from "../extension-manifests.js";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const id = "extension-capability-contract";
const docs = "https://shopify.dev/docs/apps/build/checkout/capabilities";
const blockProgressDeprecation =
  "https://shopify.dev/changelog/deprecating-the-usebuyerjourneyintercept-api-on-checkout-ui-extensions";
const blockProgressDeprecatedFrom = "2026-07";
const quarterlyVersion = /^20\d{2}-(?:01|04|07|10)$/u;
const capabilityTargets = /^(?:purchase|customer-account)\./u;
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

type Capability = "network_access" | "api_access" | "block_progress";

const usages: readonly {
  readonly capability: Capability;
  readonly label: string;
  readonly pattern: RegExp;
  readonly shadowedBy?: RegExp;
}[] = [
  {
    capability: "network_access",
    label: "fetch()",
    pattern: /(?:(?<![.\w$])|\b(?:globalThis|window|self)\.)fetch\s*\(/u,
    shadowedBy: /\b(?:function|const|let|var|class)\s+fetch\b|\bimport\s*\{[^}]*\bfetch\b[^}]*\}|\bimport\s+fetch\b/u,
  },
  {
    capability: "api_access",
    label: "Storefront API query()",
    pattern:
      /\bshopify\.query\s*\(|\buseApi\s*(?:<[^>()]*>)?\s*\(\s*\)\s*\.query\b|\{[^{}]*\bquery\b[^{}]*\}\s*=\s*useApi\b/u,
  },
  {
    capability: "block_progress",
    label: "buyer journey interception",
    pattern: /\buseBuyerJourneyIntercept\s*\(|\bbuyerJourney\s*\.\s*intercept\s*\(/u,
  },
];

/** Blanks comments and quoted strings so documentation and copy cannot impersonate a call. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/gu, (match) =>
    match.startsWith("/") ? " " : '""',
  );
}

function capabilityEntries(extensions: readonly Record<string, unknown>[]): readonly Record<string, unknown>[] {
  return extensions.filter(
    (entry) =>
      entry.type === "ui_extension" &&
      Array.isArray(entry.targeting) &&
      entry.targeting.some(
        (target) => isRecord(target) && typeof target.target === "string" && capabilityTargets.test(target.target),
      ),
  );
}

/**
 * Opt-in check. It compares capability declarations with source usage; it does not establish what
 * the platform does at run time when a capability is absent.
 *
 * @attribution https://shopify.dev/docs/apps/build/checkout/capabilities (inspiration; independently implemented)
 * @attribution https://shopify.dev/changelog/deprecating-the-usebuyerjourneyintercept-api-on-checkout-ui-extensions (inspiration; independently implemented)
 */
export const extensionCapabilityContract: ConformanceCheck = {
  id,
  description:
    "Checkout and customer account UI extension source that uses fetch, Storefront API queries, or buyer journey interception must declare the matching capability in its extension TOML.",
  docs,
  async run(options) {
    const { manifests, findings } = await readExtensionManifests(options, id, docs);
    for (const manifest of manifests) {
      const entries = capabilityEntries(manifest.extensions);
      if (entries.length === 0) continue;
      const declared = (capability: Capability): boolean =>
        [...entries, manifest.config].some(
          (owner) => isRecord(owner.capabilities) && owner.capabilities[capability] === true,
        );
      const extensionRoot = path.dirname(manifest.path);
      const used = new Map<Capability, { readonly file: string; readonly label: string }>();
      for (const file of (
        await walkFiles(path.join(extensionRoot, "src"), {
          extensions: sourceExtensions,
          maxDepth: 10,
        })
      ).toSorted()) {
        if (/\.(?:test|spec)\.[^.]+$|\.d\.ts$/u.test(file)) continue;
        const code = codeOnly((await readTextFile(file)) ?? "");
        for (const usage of usages) {
          if (used.has(usage.capability) || !usage.pattern.test(code) || usage.shadowedBy?.test(code)) continue;
          used.set(usage.capability, { file, label: usage.label });
        }
      }
      for (const [capability, usage] of used) {
        if (declared(capability)) continue;
        findings.push({
          check: id,
          docs,
          path: manifest.path,
          severity: "error",
          message: `Capability contract mismatch: ${path.relative(extensionRoot, usage.file).replaceAll("\\", "/")} uses ${usage.label} but no checkout or customer account extension in this manifest declares ${capability} = true under [extensions.capabilities]. Declare the capability or remove the usage.`,
        });
      }
      if (!declared("block_progress")) continue;
      const versions = entries.map((entry) =>
        Object.hasOwn(entry, "api_version") ? entry.api_version : manifest.config.api_version,
      );
      const deprecated = versions.find(
        (version): version is string =>
          typeof version === "string" && quarterlyVersion.test(version) && version >= blockProgressDeprecatedFrom,
      );
      if (deprecated !== undefined)
        findings.push({
          check: id,
          docs: blockProgressDeprecation,
          path: manifest.path,
          severity: "warning",
          message: `block_progress is declared with api_version ${deprecated}; the capability and useBuyerJourneyIntercept are deprecated from ${blockProgressDeprecatedFrom}. Move blocking logic to a cart and checkout validation Function.`,
        } satisfies ConformanceFinding);
    }
    return findings;
  },
};
