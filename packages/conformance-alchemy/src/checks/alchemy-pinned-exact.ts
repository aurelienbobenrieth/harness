/**
 * Requires an exact `alchemy` version in every workspace manifest while Alchemy is pre-1.0 or a
 * prerelease. Betas break without a major bump: 2.0.0-beta.78 made every non-interactive deploy under bun
 * crash in the CLI renderer, so a caret range can break CI on the next lockfile refresh.
 *
 * @attribution https://github.com/alchemy-run/alchemy/issues/1689 (inspiration; independently implemented)
 */
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord } from "../project-files.js";
import { loadWorkspace, type Workspace } from "../workspace.js";

const id = "alchemy-pinned-exact";
const docs = "https://github.com/alchemy-run/alchemy/issues/1689";

const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies"] as const;
const exactVersion = /^=?v?(\d+)\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/u;
const firstVersion = /(\d+)\.\d+\.\d+(-[0-9A-Za-z.-]+)?/u;

type Resolution =
  | { readonly kind: "spec"; readonly spec: string; readonly via?: string }
  | { readonly kind: "missing"; readonly reason: string };

function resolveCatalog(spec: string, workspace: Workspace): Resolution {
  if (!spec.startsWith("catalog:")) return { kind: "spec", spec };
  const name = spec.slice("catalog:".length) || "default";
  if (workspace.pnpmWorkspace === undefined)
    return { kind: "missing", reason: `${spec} needs a pnpm-workspace.yaml catalog; none was found` };
  if (workspace.pnpmWorkspace === false)
    return { kind: "missing", reason: "pnpm-workspace.yaml is not valid YAML, so the catalog cannot be read" };
  const entry = workspace.catalogs.get(name)?.["alchemy"];
  if (typeof entry !== "string" && typeof entry !== "number")
    return { kind: "missing", reason: `pnpm-workspace.yaml has no alchemy entry in catalog "${name}"` };
  return { kind: "spec", spec: String(entry), via: `pnpm-workspace.yaml catalog "${name}"` };
}

/** `exact`, `range` of a pre-1.0 or prerelease line, `stable-range` of a 1.0+ release line, or `unsupported`. */
function classify(spec: string): "exact" | "range" | "stable-range" | "unsupported" {
  const version = spec.startsWith("npm:") ? spec.slice(spec.lastIndexOf("@") + 1) : spec;
  if (/^(?:workspace|link|file|portal|git\+|github:|https?:)/u.test(version)) return "unsupported";
  if (exactVersion.test(version.trim())) return "exact";
  const lower = firstVersion.exec(version);
  if (lower !== null && Number(lower[1]) >= 1 && lower[2] === undefined) return "stable-range";
  return "range";
}

export const alchemyPinnedExact: ConformanceCheck = {
  id,
  description:
    "Every workspace package.json pins alchemy to an exact version (pnpm catalogs resolved) while Alchemy is pre-1.0 or a prerelease.",
  docs,
  async run(options) {
    const workspace = await loadWorkspace(options.root);
    const findings: ConformanceFinding[] = workspace.unreadable.map((manifest) => ({
      check: id,
      docs,
      path: manifest,
      severity: "error",
      evaluation: "failed",
      message: `${manifest} is not a valid JSON object. Fix it so package managers and this check can read it.`,
    }));
    let declared = 0;
    for (const manifest of workspace.manifests)
      for (const field of dependencyFields) {
        const dependencies = manifest.json[field];
        const raw = isRecord(dependencies) ? dependencies["alchemy"] : undefined;
        if (typeof raw !== "string") continue;
        declared += 1;
        const base = { check: id, docs, path: manifest.path } as const;
        const resolution = resolveCatalog(raw, workspace);
        if (resolution.kind === "missing") {
          findings.push({
            ...base,
            severity: "error",
            evaluation: "failed",
            message: `${field}.alchemy: ${resolution.reason}.`,
          });
          continue;
        }
        const written =
          resolution.via === undefined ? `"${raw}"` : `"${raw}" (${resolution.via}: "${resolution.spec}")`;
        const kind = classify(resolution.spec);
        if (kind === "range")
          findings.push({
            ...base,
            severity: "error",
            message: `${field}.alchemy is ${written}, a range on a pre-1.0 or prerelease line. Pin the exact version (e.g. "2.0.0-beta.79"): betas break without a major bump.`,
          });
        else if (kind === "unsupported")
          findings.push({
            ...base,
            severity: "warning",
            evaluation: "unsupported",
            message: `${field}.alchemy is ${written}, a protocol this check does not resolve, so its pinning was not reviewed.`,
          });
      }
    if (declared === 0 && findings.length === 0)
      findings.push({
        check: id,
        docs,
        severity: "error",
        evaluation: "failed",
        message:
          "No workspace package.json declares alchemy in dependencies, devDependencies, or optionalDependencies. Point `root` at the repository root.",
      });
    return findings;
  },
};
