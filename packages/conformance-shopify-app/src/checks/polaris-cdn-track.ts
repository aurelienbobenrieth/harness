import path from "node:path";
import { isRecord } from "../config-support.js";
import { documentEntries, withoutComments } from "../document-entries.js";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile } from "../fs-support.js";

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
const prereleaseTypes = /^(\d+)\.(\d+)\.\d+-rc\b/u;

/** The script a types version pairs with: the matching release-candidate channel for prerelease types, else the major channel. */
function matchingScript(version: string, major: number): string {
  const candidate = prereleaseTypes.exec(version);
  return candidate === null ? `polaris-${major}.js` : `polaris-${candidate[1]}.${candidate[2]}-rc.js`;
}

function parseJson(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function declaresTypes(manifest: Record<string, unknown> | undefined): boolean {
  return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].some(
    (field) => isRecord(manifest?.[field]) && Object.hasOwn(manifest[field], typesPackage),
  );
}

/**
 * Compares the Polaris CDN major each App Home document loads with the major of the installed
 * `@shopify/polaris-types`, which Shopify versions in lockstep with the CDN, and warns on release-candidate
 * channels. Documents that load no Polaris script, including templates whose provider injects it at run time,
 * stay silent.
 *
 * @attribution https://shopify.dev/changelog/the-polaris-cdn-is-adopting-semantic-versioning (inspiration; independently implemented)
 * @attribution https://shopify.dev/changelog/polaris-cdn-1-1-is-now-stable (inspiration; independently implemented)
 * @attribution https://community.shopify.dev/t/polaris-2-0-release-candidate/37957 (inspiration: the 2.0 RC channel name; independently implemented)
 */
export const polarisCdnTrack: ConformanceCheck = {
  id,
  description:
    "App Home documents that load Polaris web components from the Shopify CDN must load the same major version as the installed @shopify/polaris-types.",
  docs,
  async run(options) {
    const scripts: { readonly file: string; readonly channel: string; readonly major: number }[] = [];
    for (const file of await documentEntries(options)) {
      const content = withoutComments((await readTextFile(file)) ?? "");
      for (const match of content.matchAll(polarisScript)) {
        const channel = match[2] ?? "";
        scripts.push({ file, channel, major: match[3] === undefined ? legacyChannelMajor : Number(match[3]) });
      }
    }
    if (scripts.length === 0) return [];
    const installed = parseJson(
      await readTextFile(path.join(options.root, "node_modules", ...typesPackage.split("/"), "package.json")),
    );
    const version = typeof installed?.version === "string" ? installed.version : undefined;
    const findings: ConformanceFinding[] = [];
    if (version === undefined) {
      if (declaresTypes(parseJson(await readTextFile(path.join(options.root, "package.json")))))
        findings.push({
          check: id,
          docs,
          path: "package.json",
          severity: "warning",
          message: `${typesPackage} is declared but not installed at the project root, so the Polaris CDN major cannot be compared. Install dependencies before running conformance.`,
        });
      return findings;
    }
    const typesMajor = Number(/^(\d+)\./u.exec(version)?.[1]);
    for (const script of scripts) {
      if (script.channel.endsWith("-rc.js"))
        findings.push({
          check: id,
          docs,
          path: script.file,
          severity: "warning",
          message: `Loads the release candidate ${script.channel}, which can change before its stable release. Test with it, then ship polaris-${script.major}.js once that major is stable.`,
        });
      if (script.major === typesMajor) continue;
      findings.push({
        check: id,
        docs,
        path: script.file,
        severity: "error",
        message: `Loads Polaris ${script.major}.x from ${script.channel} while ${typesPackage} ${version} describes major ${typesMajor}. Types and runtime components must share a major: load ${matchingScript(version, typesMajor)} or install ${typesPackage}@${script.major}.`,
      });
    }
    return findings;
  },
};
