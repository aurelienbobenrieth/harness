import path from "node:path";
import type { Rule } from "@oxlint/plugins";

const message =
  "Features stay independent islands: import shared modules (runtime, events) instead of reaching into a sibling feature.";

type RuleOptions = {
  readonly featuresDir?: string;
  readonly shared?: readonly string[];
};

const defaultFeaturesDir = "frontend/features";
const defaultShared = ["runtime", "storefront-events"];

function ruleOptions(context: unknown): Required<RuleOptions> {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  const parsed: RuleOptions = typeof first === "object" && first !== null ? (first as RuleOptions) : {};
  return {
    featuresDir:
      typeof parsed.featuresDir === "string" && parsed.featuresDir.length > 0 ? parsed.featuresDir : defaultFeaturesDir,
    shared: Array.isArray(parsed.shared)
      ? parsed.shared.filter((entry): entry is string => typeof entry === "string")
      : defaultShared,
  };
}

function filenameOf(context: unknown): string {
  const holder = context as { readonly filename?: unknown; readonly getFilename?: () => unknown };
  const direct = holder.filename;
  if (typeof direct === "string") return direct;
  const fromGetter = holder.getFilename?.();
  return typeof fromGetter === "string" ? fromGetter : "";
}

function featureOf(filePath: string, featuresDir: string): string | undefined {
  const normalized = filePath.replaceAll("\\", "/");
  const marker = `${featuresDir}/`;
  const index = normalized.indexOf(marker);
  if (index === -1) return undefined;
  const rest = normalized.slice(index + marker.length);
  const feature = rest.split("/")[0];
  return feature !== undefined && feature.length > 0 ? feature : undefined;
}

export const featureBoundaries: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow imports between sibling feature directories except shared modules.",
    },
    messages: {
      featureBoundaries: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          featuresDir: { type: "string" },
          shared: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        const specifier = node.source.value;
        if (typeof specifier !== "string" || !specifier.startsWith(".")) return;

        const { featuresDir, shared } = ruleOptions(context);
        const filename = filenameOf(context).replaceAll("\\", "/");
        const ownFeature = featureOf(filename, featuresDir);
        if (ownFeature === undefined) return;

        const resolved = path.posix.join(path.posix.dirname(filename), specifier);
        const importedFeature = featureOf(resolved, featuresDir);
        if (importedFeature === undefined) return;
        if (importedFeature === ownFeature) return;
        if (shared.includes(importedFeature)) return;

        context.report({ node, messageId: "featureBoundaries" });
      },
    };
  },
};
