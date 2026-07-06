import { readFileSync } from "node:fs";
import path from "node:path";
import { defineRule, type AgentlintRule } from "@aurelienbbn/agentlint";

export type RegistryDriftOptions = {
  /** Path to the primitive registry JSON, resolved from the working directory. */
  readonly registryPath?: string;
  /** File patterns that must be registered. Default: feature enhancers and machines. */
  readonly filePattern?: RegExp;
};

const defaultFilePattern = /frontend\/features\/[^/]+\/[^/]+-(?:enhancer|machine)\.ts$/;

type RegistryFile = {
  readonly primitives?: readonly { readonly path?: string }[];
};

function registeredPaths(registryPath: string): ReadonlySet<string> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path.resolve(registryPath), "utf8")) as RegistryFile;
    return new Set(
      (parsed.primitives ?? [])
        .map((entry) => entry.path?.replaceAll("\\", "/"))
        .filter((entry): entry is string => typeof entry === "string"),
    );
  } catch {
    return undefined;
  }
}

export function defineRegistryDrift(options: RegistryDriftOptions = {}): AgentlintRule {
  const registryPath = options.registryPath ?? "registry.json";
  const filePattern = options.filePattern ?? defaultFilePattern;

  return defineRule({
    id: "shopify-theme/registry-drift",
    description: "Flags delivery modules that are absent from the primitive registry.",
    guidance: {
      standard:
        "The primitive registry is the source of truth for what the theme ships. Every enhancer and machine must be a registered delivery artifact so docs, surface audits, and conformance checks see it; unregistered modules are invisible to the system.",
      checks: [
        "New enhancers/machines get a registry entry (scaffold with `oio scaffold`, or run the annotation script).",
        "Renamed files update the registry path in the same change.",
        "Registry entries removed from the codebase are deleted or re-statused rather than left dangling.",
      ],
    },
    createOnce(context) {
      let known: ReadonlySet<string> | undefined;

      return {
        before(filename) {
          const normalized = filename.replaceAll("\\", "/");
          if (!filePattern.test(normalized)) return false;
          if (normalized.endsWith(".test.ts")) return false;
          known ??= registeredPaths(registryPath);
          return undefined;
        },
        program(node) {
          if (known === undefined) return; // no registry: conformance registry-sync reports it
          const filePath = context.getFilePath();
          if (known.has(filePath)) return;
          context.report({
            node,
            message: `${filePath} is not registered in the primitive registry: add or update its entry.`,
          });
        },
      };
    },
  });
}

export const registryDrift = defineRegistryDrift();
