import path from "node:path";
import { isRecord } from "../config-support.js";
import { readExtensionManifests } from "../extension-manifests.js";
import type { ConformanceCheck } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const id = "extension-framework-contract";
const docs = "https://shopify.dev/docs/apps/build/checkout/migrate-to-web-components";
const reactPackage = "@shopify/ui-extensions-react";
/** First version where UI extensions use Polaris web components; reviewed on shopify.dev 2026-09-24. */
const webComponentsFrom = "2025-10";
const quarterlyVersion = /^20\d{2}-(?:01|04|07|10)$/u;
const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const reactImport =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'`])@shopify\/ui-extensions-react(?:\/[^"'`]*)?\1/u;

function webComponentsVersion(value: unknown): string | undefined {
  if (value === "unstable") return value;
  return typeof value === "string" && quarterlyVersion.test(value) && value >= webComponentsFrom ? value : undefined;
}

/**
 * UI extensions on 2025-10 or later render Polaris web components with Preact; the React bindings
 * package stops at the 2025-07 line. Flags the package declared in the extension's package.json or
 * imported from its `src/`, never guessing versions from the system clock.
 *
 * @attribution https://shopify.dev/docs/apps/build/checkout/migrate-to-web-components (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/build/customer-accounts/migrate-to-web-components (inspiration; independently implemented)
 */
export const extensionFrameworkContract: ConformanceCheck = {
  id,
  description:
    "UI extensions on API version 2025-10 or later must not depend on or import @shopify/ui-extensions-react; they use Polaris web components with Preact.",
  docs,
  async run(options) {
    const { manifests, findings } = await readExtensionManifests(options, id, docs);
    for (const manifest of manifests) {
      const version = manifest.extensions
        .filter((entry) => entry.type === "ui_extension")
        .map((entry) =>
          webComponentsVersion(Object.hasOwn(entry, "api_version") ? entry.api_version : manifest.config.api_version),
        )
        .find((value) => value !== undefined);
      if (version === undefined) continue;
      const extensionRoot = path.dirname(manifest.path);
      const report = (at: string, evidence: string): void => {
        findings.push({
          check: id,
          docs,
          path: at,
          severity: "error",
          message: `${evidence} ${reactPackage}, but this UI extension targets api_version ${version}. From ${webComponentsFrom}, extensions render Polaris web components with Preact: migrate to @shopify/ui-extensions with preact and remove the React package.`,
        });
      };
      const packagePath = path.join(extensionRoot, "package.json");
      const packageText = await readTextFile(packagePath);
      let packageJson: unknown;
      try {
        packageJson = packageText === undefined ? undefined : JSON.parse(packageText);
      } catch {
        packageJson = undefined;
      }
      const declaredIn = dependencyFields.find(
        (field) =>
          isRecord(packageJson) && isRecord(packageJson[field]) && Object.hasOwn(packageJson[field], reactPackage),
      );
      if (declaredIn !== undefined) report(packagePath, `package.json ${declaredIn} declares`);
      for (const file of (
        await walkFiles(path.join(extensionRoot, "src"), {
          extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
          maxDepth: 10,
        })
      ).toSorted()) {
        if (file.endsWith(".d.ts")) continue;
        const code = ((await readTextFile(file)) ?? "").replace(/\/\*[\s\S]*?\*\/|(?<![:"'`\w])\/\/[^\n]*/gu, " ");
        if (!reactImport.test(code)) continue;
        report(file, `${path.relative(extensionRoot, file).replaceAll("\\", "/")} imports`);
        break;
      }
    }
    return findings;
  },
};
