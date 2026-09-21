import { parse, type DefaultTreeAdapterMap } from "parse5";
import { parseToml } from "../toml-support.js";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding, ConformanceRunOptions } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";
import { appManifests } from "../app-manifests.js";

const docs = "https://shopify.dev/docs/apps/launch/built-for-shopify/requirements";
const appBridgeScriptMarker = "cdn.shopify.com/shopifycloud/app-bridge.js";
const defaultPlatformMarkers: readonly string[] = [];
const documentBasenames = new Set(["index.html", "root.tsx", "root.jsx", "__root.tsx", "__root.jsx"]);
async function isEmbeddedApp(options: ConformanceRunOptions): Promise<boolean> {
  const { root } = options;
  const configFiles = await appManifests(options);
  if (configFiles.length === 0) return true;
  for (const configFile of configFiles) {
    const content = (await readTextFile(path.join(root, configFile))) ?? "";
    if (parseToml(content)?.embedded !== false) return true;
  }
  return false;
}

/** @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently implemented) */
export const appBridgeScript: ConformanceCheck = {
  id: "app-bridge-script",
  description: "Embedded apps must load the App Bridge script from the Shopify CDN in the document head.",
  docs,
  async run(options) {
    const { root, platformMarkers } = options;
    if (!(await isEmbeddedApp(options))) return [];

    const markers = platformMarkers ?? defaultPlatformMarkers;
    const discovered = (await walkFiles(root, { extensions: [".html", ".tsx", ".jsx"], maxDepth: 4 })).filter(
      (filePath) => documentBasenames.has(path.basename(filePath)),
    );

    const candidates =
      options.documentEntries === undefined
        ? discovered
        : options.documentEntries.map((entry) => {
            const relative = path.relative(path.resolve(root), path.resolve(root, entry));
            if (entry === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
              throw new Error("documentEntries must name project-relative document files inside the project.");
            return path.resolve(root, entry);
          });
    if (options.documentEntries?.length === 0) throw new Error("documentEntries must include at least one document.");
    if (markers.some((marker) => marker.trim() === ""))
      throw new Error("platformMarkers must contain nonempty integration markers.");
    if (candidates.length === 0) {
      return [
        {
          check: "app-bridge-script",
          severity: "warning",
          message:
            "No document entry (index.html or root layout) found: verify the App Bridge script tag is present in the served document head.",
          docs,
        },
      ];
    }

    const findings: ConformanceFinding[] = [];
    for (const candidate of new Set(candidates)) {
      const content = (await readTextFile(candidate)) ?? "";
      if (hasBridgeScript(content)) continue;
      const uncommented = content.replaceAll(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, "");
      if (markers.some((marker) => uncommented.includes(marker))) continue;
      findings.push({
        check: "app-bridge-script",
        severity: "error",
        docs,
        path: candidate,
        message:
          "Load https://cdn.shopify.com/shopifycloud/app-bridge.js as the first script in this document head, or configure a verified platform injector marker. Verify every served document separately.",
      });
    }
    return findings;
  },
};

function hasBridgeScript(content: string): boolean {
  const uncommented = content.replaceAll(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, "");
  const head = /<head\b[^>]*>[\s\S]*?<\/head>/i.exec(uncommented)?.[0];
  if (head === undefined) return false;
  const document = parse(head);
  const scripts: DefaultTreeAdapterMap["element"][] = [];
  function visit(node: DefaultTreeAdapterMap["node"]): void {
    if ("tagName" in node && node.tagName === "script") scripts.push(node);
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  }
  visit(document);
  const first = scripts[0];
  return (
    first !== undefined &&
    first.parentNode !== null &&
    "tagName" in first.parentNode &&
    first.parentNode.tagName === "head" &&
    first.attrs.some((attr) => attr.name === "src" && attr.value === `https://${appBridgeScriptMarker}`)
  );
}
