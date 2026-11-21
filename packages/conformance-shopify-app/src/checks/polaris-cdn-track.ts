import path from "node:path";
import { isRecord } from "../config-support.js";
import { documentEntries, withoutComments } from "../document-entries.js";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const id = "polaris-cdn-track";
const docs = "https://shopify.dev/changelog/the-polaris-cdn-is-adopting-semantic-versioning";
const typesPackage = "@shopify/polaris-types";
const polarisScript =
  /<script\b[^>]*?\bsrc\s*=\s*\{?\s*(["'`])https:\/\/cdn\.shopify\.com\/shopifycloud\/(polaris(?:-(\d+)(?:\.\d+)?(?:-rc)?)?\.js)\1/gu;
/**
 * `polaris.js` never moves to a new major on its own; it served the 1.x line when reviewed on 2026-09-24
 * (https://shopify.dev/changelog/polaris-cdn-1-1-is-now-stable).
 */
const legacyChannelMajor = 1;
const typesVersion = /^(\d+)\.(\d+)\.\d+(-rc\b)?/u;
/** Workspace packages sit a few folders below the root (`packages/<name>`, `apps/<group>/<name>`). */
const workspaceDepth = 3;

type InstalledTypes = {
  readonly version: string;
  readonly major: number;
  readonly minor: number;
  readonly rc: boolean;
};
function parseJson(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The types installed in `directory`'s own `node_modules`, when their manifest carries a semantic version. */
async function typesIn(directory: string): Promise<InstalledTypes | undefined> {
  const manifest = parseJson(
    await readTextFile(path.join(directory, "node_modules", ...typesPackage.split("/"), "package.json")),
  );
  const version = typeof manifest?.version === "string" ? manifest.version : undefined;
  const parsed = version === undefined ? null : typesVersion.exec(version);
  if (version === undefined || parsed === null) return undefined;
  return { version, major: Number(parsed[1]), minor: Number(parsed[2]), rc: parsed[3] !== undefined };
}

/** The script a types version pairs with: the major channel, or its minor channel when pinned; RC types use the RC channel. */
function matchingScript(types: InstalledTypes, pin: "major" | "minor"): string {
  if (types.rc) return `polaris-${types.major}.${types.minor}-rc.js`;
  return pin === "minor" ? `polaris-${types.major}.${types.minor}.js` : `polaris-${types.major}.js`;
}

/**
 * Compares the Polaris CDN script each App Home document loads with the `@shopify/polaris-types` that Shopify
 * versions in lockstep with the CDN, and warns on release-candidate channels and on every document whose types
 * cannot be resolved. Types resolve like a Node import from the document's folder up to the project root; when
 * none is on that path, the one version installed across the workspace packages is used. Documents that load no
 * Polaris script, including templates whose provider injects it at run time, stay silent.
 *
 * @attribution https://shopify.dev/changelog/the-polaris-cdn-is-adopting-semantic-versioning (inspiration; independently implemented)
 * @attribution https://shopify.dev/changelog/polaris-cdn-1-1-is-now-stable (inspiration; independently implemented)
 * @attribution https://community.shopify.dev/t/polaris-2-0-release-candidate/37957 (inspiration: the 2.0 RC channel name; independently implemented)
 */
export const polarisCdnTrack: ConformanceCheck = {
  id,
  description:
    "App Home documents that load Polaris web components from the Shopify CDN must load the major, or with polarisCdnPin the minor, of the @shopify/polaris-types their package resolves.",
  docs,
  async run(options) {
    const pin = options.polarisCdnPin ?? "major";
    if (pin !== "major" && pin !== "minor") throw new Error('polarisCdnPin must be "major" or "minor".');
    const root = path.resolve(options.root);
    let workspace: readonly InstalledTypes[] | undefined;
    const workspaceTypes = async (): Promise<readonly InstalledTypes[]> => {
      if (workspace !== undefined) return workspace;
      const found = new Map<string, InstalledTypes>();
      for (const manifest of await walkFiles(root, { extensions: ["package.json"], maxDepth: workspaceDepth })) {
        if (path.basename(manifest) !== "package.json") continue;
        const types = await typesIn(path.dirname(manifest));
        if (types !== undefined) found.set(types.version, types);
      }
      workspace = [...found.values()].toSorted((a, b) => a.version.localeCompare(b.version));
      return workspace;
    };
    const resolveTypes = async (document: string): Promise<readonly InstalledTypes[]> => {
      for (let directory = path.dirname(document); ; directory = path.dirname(directory)) {
        const types = await typesIn(directory);
        if (types !== undefined) return [types];
        if (directory === root || path.dirname(directory) === directory) break;
      }
      return workspaceTypes();
    };
    const findings: ConformanceFinding[] = [];
    for (const file of await documentEntries(options)) {
      const content = withoutComments((await readTextFile(file)) ?? "");
      const scripts = [...content.matchAll(polarisScript)].map((match) => ({
        channel: match[2] ?? "",
        major: match[3] === undefined ? legacyChannelMajor : Number(match[3]),
      }));
      if (scripts.length === 0) continue;
      const candidates = await resolveTypes(file);
      const [types] = candidates;
      if (types === undefined || candidates.length > 1) {
        findings.push({
          check: id,
          docs,
          path: file,
          severity: "warning",
          message:
            types === undefined
              ? `No installed ${typesPackage} resolves from this document's package or the workspace, so its Polaris CDN script cannot be compared. Install the types in the package that serves this document and install dependencies before running conformance.`
              : `The workspace installs ${typesPackage} ${candidates.map((candidate) => candidate.version).join(" and ")}, none on this document's path, so its Polaris CDN script cannot be compared. Install the types in the package that serves this document.`,
        });
        continue;
      }
      const expected = matchingScript(types, pin);
      for (const script of scripts) {
        if (script.channel.endsWith("-rc.js"))
          findings.push({
            check: id,
            docs,
            path: file,
            severity: "warning",
            message: `Loads the release candidate ${script.channel}, which can change before its stable release. Test with it, then ship the stable script once that release is stable.`,
          });
        if (pin === "major" ? script.major === types.major : script.channel === expected) continue;
        findings.push({
          check: id,
          docs,
          path: file,
          severity: "error",
          message:
            pin === "major"
              ? `Loads Polaris ${script.major}.x from ${script.channel} while ${typesPackage} ${types.version} describes major ${types.major}. Types and runtime components must share a major: load ${expected} or install ${typesPackage}@${script.major}.`
              : `Loads ${script.channel} while ${typesPackage} ${types.version} pins Polaris ${types.major}.${types.minor}. Load ${expected}, so a Polaris release reaches merchants only with a types bump.`,
        });
      }
    }
    return findings;
  },
};
