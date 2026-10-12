/**
 * @attribution KeepCart/app tools/workspace-boundaries (same author; generalised with configurable apps and a forbidden-import matrix)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import path from "node:path";
import { boundaryViolation, type ForbiddenImport, matchesDirectory, type Member } from "./boundaries.js";
import { findWorkspace, type Manifest, readManifests } from "./workspace.js";

type Options = {
  readonly apps?: readonly string[];
  readonly forbidden?: readonly ForbiddenImport[];
};

type SourceNode =
  | ESTree.ImportDeclaration
  | ESTree.ExportAllDeclaration
  | ESTree.ExportNamedDeclaration
  | ESTree.ImportExpression;

const defaultApps: readonly string[] = ["apps/**"];

/** One read per workspace root per lint process; an editor language server sees new members after a restart. */
const manifestsByRoot = new Map<string, readonly Manifest[]>();

function manifestsOf(workspace: NonNullable<ReturnType<typeof findWorkspace>>): readonly Manifest[] {
  const cached = manifestsByRoot.get(workspace.root);
  if (cached !== undefined) return cached;
  const manifests = readManifests(workspace);
  manifestsByRoot.set(workspace.root, manifests);
  return manifests;
}

function literalSource(node: SourceNode): string | undefined {
  const source = node.source;
  return source !== null && source.type === "Literal" && typeof source.value === "string" ? source.value : undefined;
}

export const workspaceBoundaries: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep workspace members apart: packages never import apps, members enter each other only through package.json exports and never by relative path, and configured member pairs never import each other.",
    },
    schema: [
      {
        type: "object",
        properties: {
          apps: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
          },
          forbidden: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string", minLength: 1 },
                to: { type: "string", minLength: 1 },
                message: { type: "string", minLength: 1 },
              },
              required: ["from", "to"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const filename = context.filename;
    const workspace = findWorkspace(filename);
    if (workspace === undefined) return {};

    const apps = options.apps ?? defaultApps;
    const members: readonly Member[] = manifestsOf(workspace).map((manifest) => ({
      ...manifest,
      kind: apps.some((pattern) => matchesDirectory(pattern, manifest.dir)) ? "app" : "package",
    }));
    const importer = path.relative(workspace.root, filename).replaceAll("\\", "/");
    const check = (node: SourceNode): void => {
      const specifier = literalSource(node);
      if (specifier === undefined) return;
      const message = boundaryViolation({ members, importer, specifier, forbidden: options.forbidden ?? [] });
      if (message !== undefined) context.report({ node, message });
    };

    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportExpression: check,
    };
  },
};
