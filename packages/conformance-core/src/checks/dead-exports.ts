/**
 * Runs knip (when installed) and fails on unused files and exports. Without
 * knip the check degrades to a warning instead of failing.
 */
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { fileExists, isRecord, parseJson, readTextFile } from "../fs-support.js";
import { excerpt, resolveToolBin, runTool } from "../tool-support.js";

const docs = "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#dead-exports";
const maxListed = 10;

const knipConfigFiles = [
  "knip.json",
  "knip.jsonc",
  ".knip.json",
  ".knip.jsonc",
  "knip.ts",
  "knip.js",
  "knip.config.ts",
  "knip.config.js",
];

async function hasKnipConfig(root: string): Promise<boolean> {
  for (const configFile of knipConfigFiles) {
    if (await fileExists(path.join(root, configFile))) return true;
  }
  const manifest = parseJson(await readTextFile(path.join(root, "package.json")));
  return isRecord(manifest) && manifest["knip"] !== undefined;
}

function entryName(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (isRecord(entry) && typeof entry["name"] === "string") return entry["name"];
  return undefined;
}

function validReport(parsed: unknown): boolean {
  if (!Array.isArray(parsed) && !isRecord(parsed)) return false;
  if (isRecord(parsed)) {
    if (!Array.isArray(parsed.files) && !Array.isArray(parsed.issues)) return false;
    if (
      parsed.files !== undefined &&
      (!Array.isArray(parsed.files) || !parsed.files.every((file) => entryName(file)?.trim()))
    )
      return false;
    if (parsed.issues !== undefined && !Array.isArray(parsed.issues)) return false;
  }
  const issues = Array.isArray(parsed) ? parsed : (parsed.issues ?? []);
  return (
    Array.isArray(issues) &&
    issues.every((issue) => {
      if (!isRecord(issue) || typeof issue.file !== "string" || issue.file.trim() === "") return false;
      return ["exports", "types", "nsExports", "nsTypes", "enumMembers", "classMembers"].every(
        (key) =>
          issue[key] === undefined ||
          (Array.isArray(issue[key]) && issue[key].every((entry: unknown) => entryName(entry)?.trim())),
      );
    })
  );
}

/**
 * Extracts unused files and exports from knip JSON output. Knip's `json`
 * reporter shape has shifted across majors ({files, issues} object vs a plain
 * issue array), so both are parsed defensively.
 */
function collectIssues(parsed: unknown): readonly string[] {
  const issues: string[] = [];
  const record = isRecord(parsed) ? parsed : {};
  const files = Array.isArray(record["files"]) ? record["files"] : [];
  for (const file of files) {
    const name = entryName(file);
    if (name !== undefined) issues.push(`unused file ${name}`);
  }
  const issueEntries = Array.isArray(parsed) ? parsed : Array.isArray(record["issues"]) ? record["issues"] : [];
  for (const issue of issueEntries) {
    if (!isRecord(issue)) continue;
    const file = typeof issue["file"] === "string" ? issue["file"] : "unknown file";
    for (const key of ["exports", "types", "nsExports", "nsTypes", "enumMembers", "classMembers"]) {
      const entries = issue[key];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const name = entryName(entry);
        if (name !== undefined) issues.push(`unused export ${name} in ${file}`);
      }
    }
  }
  return issues;
}

export const deadExports: ConformanceCheck = {
  id: "dead-exports",
  description: "No unused files or exports remain in the codebase (knip).",
  docs,
  async run({ root, deadExports: options }) {
    if (options?.requireKnipConfig === true && !(await hasKnipConfig(root))) {
      return [
        {
          check: "dead-exports",
          severity: "error",
          evaluation: "failed",
          message: "Required knip configuration is missing; add it before running this gate.",
          docs,
        },
      ];
    }
    const knipBin = await resolveToolBin(root, "knip");
    if (knipBin === undefined) {
      return [
        {
          check: "dead-exports",
          severity: options?.requireKnipConfig === true ? "error" : "warning",
          evaluation: "unsupported",
          message: "knip not installed — dead-export check skipped.",
          docs,
        },
      ];
    }

    const result = await runTool(process.execPath, [knipBin, "--reporter", "json"], { cwd: root });
    if (result.timedOut) {
      return [
        {
          check: "dead-exports",
          severity: options?.requireKnipConfig === true ? "error" : "warning",
          evaluation: "failed",
          message: "knip timed out after 120s — dead-export check not evaluated.",
          docs,
        },
      ];
    }

    // knip exits non-zero when it finds issues, so parse stdout regardless of exit code.
    const parsed = parseJson(result.stdout);
    if (!validReport(parsed)) {
      return [
        {
          check: "dead-exports",
          severity: options?.requireKnipConfig === true ? "error" : "warning",
          evaluation: "failed",
          message:
            `knip produced no parseable JSON — dead-export check not evaluated. ${excerpt(result.stderr)}`.trim(),
          docs,
        },
      ];
    }

    const issues = collectIssues(parsed);
    if (result.failed && issues.length === 0)
      return [
        {
          check: "dead-exports",
          severity: options?.requireKnipConfig === true ? "error" : "warning",
          evaluation: "failed",
          message: `knip exited unsuccessfully without recognized dead-export findings: ${excerpt(result.stderr)}`,
          docs,
        },
      ];
    if (issues.length === 0) return [];

    const listed = issues.slice(0, maxListed).join("; ");
    const overflow = issues.length > maxListed ? ` (+${issues.length - maxListed} more)` : "";
    const findings: ConformanceFinding[] = [
      {
        check: "dead-exports",
        severity: "error",
        message: `knip found ${issues.length} dead item(s): ${listed}${overflow}. Delete them or mark intentional entry points in the knip config.`,
        docs,
      },
    ];
    return findings;
  },
};
